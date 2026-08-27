import type { Json } from "@/types/database";
import type { SophiaContextPack, SophiaToolDefinition, SophiaToolResult } from "@/lib/sophia/types";
import { selectSophiaV4Skill, getSophiaV4Skill } from "@/lib/sophia/v4/skill-library";
import { checkSophiaV4SkillAvailability } from "@/lib/sophia/v4/skill-runner";
import { routeSophiaV4Agent } from "@/lib/sophia/v4/agents";
import { verifySophiaV4ToolResult } from "@/lib/sophia/v4/tool-verifier";
import type { SophiaV4NodeKey, SophiaV4State } from "@/lib/sophia/v4/state";

export type SophiaV4NodeDependencies = {
  contextPack?: SophiaContextPack;
  availableTools?: SophiaToolDefinition[];
  isOwner?: boolean;
  hasAttachment?: boolean;
  forcedToolId?: string | null;
  forcedInput?: Record<string, Json>;
  executeTool?: (tool: SophiaToolDefinition, input: Record<string, Json>) => Promise<SophiaToolResult>;
  verifyTool?: typeof verifySophiaV4ToolResult;
  persistLearning?: (state: SophiaV4State) => Promise<string[]>;
  emitEvent?: (state: SophiaV4State) => Promise<void>;
};

export type SophiaV4NodeHandler = (state: SophiaV4State, dependencies: SophiaV4NodeDependencies) => Promise<SophiaV4State>;

export const SOPHIA_V4_NODES: Record<SophiaV4NodeKey, SophiaV4NodeHandler> = {
  receive_input: async (state) => state,
  normalize_input: async (state) => ({ ...state, normalized_input: normalize(state.input_text) }),
  resolve_identity_and_permissions: async (state) => {
    if (!state.organization_id || !state.user_id) return { ...state, errors: [...state.errors, "identity_or_organization_missing"] };
    return state;
  },
  classify_intent: async (state, dependencies) => {
    const selection = selectSophiaV4Skill(state.input_text, { hasAttachment: dependencies.hasAttachment, role: state.user_role });
    const selected = dependencies.forcedToolId
      ? { ...selection, confidence: Math.max(selection.confidence, 1), reason: "confirmed_tool" }
      : selection;
    return {
      ...state,
      intent: selected.skill?.skill_key ?? null,
      confidence: selected.confidence,
      selected_skill: selected.skill?.skill_key ?? null,
      skill_input: dependencies.forcedInput ?? selected.input,
    };
  },
  retrieve_screen_context: async (state, dependencies) => ({
    ...state,
    retrieved_context: { ...state.retrieved_context, screen: (dependencies.contextPack?.screen ?? state.screen_context) as Json },
  }),
  retrieve_operational_context: async (state, dependencies) => ({
    ...state,
    retrieved_context: {
      ...state.retrieved_context,
      currentClient: (dependencies.contextPack?.currentClient ?? null) as Json,
      currentService: (dependencies.contextPack?.currentService ?? null) as Json,
      recentMessages: (dependencies.contextPack?.recentMessages ?? []) as unknown as Json,
    },
  }),
  retrieve_memory: async (state, dependencies) => ({ ...state, retrieved_memories: (dependencies.contextPack?.memories ?? []) as Array<Record<string, Json>> }),
  retrieve_documents: async (state, dependencies) => ({ ...state, retrieved_documents: (dependencies.contextPack?.documents ?? []) as Array<Record<string, Json>> }),
  retrieve_module_context: async (state, dependencies) => ({
    ...state,
    retrieved_context: {
      ...state.retrieved_context,
      available_tools: (dependencies.availableTools ?? []).map((tool) => tool.id) as unknown as Json,
    },
  }),
  plan: async (state, dependencies) => {
    const availableTools = dependencies.availableTools ?? [];
    const forced = dependencies.forcedToolId ? availableTools.find((tool) => tool.id === dependencies.forcedToolId) ?? null : null;
    const skill = state.selected_skill ? getSophiaV4Skill(state.selected_skill) : null;
    if (forced) return { ...state, selected_tool: forced.id, risk_level: forced.riskLevel, confirmation_required: false };
    if (!skill) return state;
    const availability = checkSophiaV4SkillAvailability({
      skill,
      context: { isOwner: Boolean(dependencies.isOwner), membership: { role: state.user_role } as never },
      availableTools,
    });
    if (!availability.available || !availability.tool) return { ...state, errors: [...state.errors, availability.reason] };
    return {
      ...state,
      selected_tool: availability.tool.id,
      risk_level: availability.tool.riskLevel,
      confirmation_required: skill.requires_confirmation || availability.tool.riskLevel !== "read",
    };
  },
  decide_response_or_tool: async (state, dependencies) => {
    const skill = state.selected_skill ? getSophiaV4Skill(state.selected_skill) : null;
    if (!skill) return state;
    try {
      const agent = routeSophiaV4Agent(skill, Boolean(dependencies.isOwner));
      return { ...state, selected_agent: agent?.key ?? null };
    } catch (error) {
      return { ...state, errors: [...state.errors, error instanceof Error ? error.message : "agent_access_denied"] };
    }
  },
  require_confirmation: async (state) => {
    if (!state.confirmation_required || state.confirmation_granted) return state;
    return {
      ...state,
      confirmation_payload: state.confirmation_payload ?? { tool_id: state.selected_tool, input: state.skill_input },
      final_answer: `Confirma executar "${state.selected_skill ?? state.selected_tool ?? "esta acao"}"?`,
    };
  },
  execute_tool: async (state, dependencies) => {
    if (state.tool_result || !state.selected_tool || !dependencies.executeTool) return state;
    const tool = (dependencies.availableTools ?? []).find((item) => item.id === state.selected_tool);
    if (!tool) return { ...state, errors: [...state.errors, "selected_tool_unavailable"] };
    try {
      return { ...state, tool_result: await dependencies.executeTool(tool, state.skill_input) };
    } catch (error) {
      return { ...state, errors: [...state.errors, error instanceof Error ? error.message : "tool_execution_failed"] };
    }
  },
  verify_tool_result: async (state, dependencies) => {
    if (!state.tool_result || !state.selected_tool) return state;
    const verifier = dependencies.verifyTool ?? verifySophiaV4ToolResult;
    return { ...state, verification_result: await verifier({ toolId: state.selected_tool, result: state.tool_result }) };
  },
  reflect_on_result: async (state) => {
    if (state.errors.length) return { ...state, reflection: `A execucao encontrou ${state.errors.length} erro(s); nao afirmar sucesso.` };
    if (state.tool_result && state.verification_result?.verified === false) return { ...state, reflection: "O handler respondeu, mas o resultado nao foi confirmado no estado real." };
    return { ...state, reflection: state.tool_result ? "Resultado executado e verificado." : "Resposta resolvida sem escrita." };
  },
  persist_learning: async (state, dependencies) => dependencies.persistLearning
    ? { ...state, learned_candidates: await dependencies.persistLearning(state) }
    : state,
  compose_answer: async (state) => {
    if (state.final_answer) return state;
    if (state.errors.length) return { ...state, final_answer: "Nao consegui concluir este pedido com seguranca. Verifique os dados informados e tente novamente." };
    if (state.tool_result) {
      if (state.verification_result && !state.verification_result.verified) return { ...state, final_answer: "A acao foi executada, mas nao consegui verificar o resultado. Nao vou informar sucesso sem confirmacao." };
      return { ...state, final_answer: state.tool_result.message };
    }
    return { ...state, final_answer: "Posso consultar servicos, clientes, tarefas, documentos e ferramentas reais do GeoGestao." };
  },
  emit_events: async (state, dependencies) => {
    if (dependencies.emitEvent) await dependencies.emitEvent(state);
    return state;
  },
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
