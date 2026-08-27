import { planWithGemini } from "@/lib/sophia/gemini-provider";
import { resolveSophiaContext } from "@/lib/sophia/context";
import { ensureSophiaConversation, saveSophiaMessage } from "@/lib/sophia/conversation";
import { assertSophiaToolAvailable, getAvailableSophiaTools } from "@/lib/sophia/permissions";
import { getSophiaTool, planSophiaToolCall } from "@/lib/sophia/tool-registry";
import { attachPlan, attachRetrievedContext, attachToolResult, finishCognitiveRuntime, startCognitiveRuntime } from "@/lib/sophia/v3/cognitive-runtime";
import type { CognitiveState } from "@/lib/sophia/v3/cognitive-state";
import { createSophiaV4State, summarizeSophiaV4State, type SophiaV4State } from "@/lib/sophia/v4/state";
import { completeSophiaV4Graph, runSophiaV4PlanningGraph } from "@/lib/sophia/v4/graph-runtime";
import { verifySophiaV4ToolResult } from "@/lib/sophia/v4/tool-verifier";
import type { Json } from "@/types/database";
import type {
  SophiaChatResponse,
  SophiaContext,
  SophiaPlan,
  SophiaRequestContext,
  SophiaRiskLevel,
} from "@/lib/sophia/types";

export async function runSophiaChat({
  context,
  message,
  requestContext,
  confirmation,
}: {
  context: SophiaContext;
  message: string;
  requestContext: SophiaRequestContext;
  confirmation?: { actionName: string; params: Record<string, Json>; selectedClientId?: string } | null;
}): Promise<SophiaChatResponse> {
  const conversation = await ensureSophiaConversation({
    supabase: context.supabase,
    conversationId: requestContext.conversationId,
    userId: context.user.id,
    organizationId: context.organizationId,
    titleSeed: message,
  });
  const userMessage = await saveSophiaMessage({
    supabase: context.supabase,
    conversationId: conversation.id,
    organizationId: context.organizationId,
    userId: context.user.id,
    role: "user",
    content: message,
    metadata: { requestContext: requestContext as Json } as Json,
  });

  const traceId = crypto.randomUUID();
  let cognitiveState = startCognitiveRuntime({
    organizationId: context.organizationId,
    userId: context.user.id,
    role: context.membership?.role ?? "member",
    query: message,
    screenContext: requestContext,
  });
  const runId = await createRun(context, {
      conversationId: conversation.id,
      traceId,
      input: { message, requestContext, confirmation: confirmation ?? null },
  });

  try {
    const contextPack = await resolveSophiaContext({ context, requestContext, message });
    cognitiveState = attachRetrievedContext(cognitiveState, contextPack);
    const availableTools = await getAvailableSophiaTools(context);
    const usableTools = availableTools.filter((item) => item.status === "available").map((item) => item.tool);
    const legacyLocalPlan = requestContext.attachments?.length && !confirmation
      ? {
          agentKey: "documents" as const,
          toolId: "document_ingest",
          input: { inbox_item_id: requestContext.attachments[0].inboxItemId } as Record<string, Json>,
          provider: "local" as const,
          confidence: 1,
          requiresConfirmation: false,
          reason: "attachment_ingest",
        }
      : planSophiaToolCall(
      message,
      confirmation ? { actionName: confirmation.actionName, params: { ...confirmation.params, selectedClientId: confirmation.selectedClientId ?? null, confirmed: true } } : null,
    );
    let v4State = createSophiaV4State({
      runId,
      organizationId: context.organizationId,
      userId: context.user.id,
      userRole: context.membership?.role ?? "member",
      inputText: message,
      screenContext: requestContext,
      confirmationGranted: Boolean(confirmation),
      confirmationPayload: confirmation?.params ?? null,
    });
    v4State = await runSophiaV4PlanningGraph(v4State, {
      contextPack,
      availableTools: usableTools,
      isOwner: context.isOwner,
      hasAttachment: Boolean(requestContext.attachments?.length),
      forcedToolId: confirmation ? legacyLocalPlan.toolId : null,
      forcedInput: confirmation ? legacyLocalPlan.input : undefined,
    });
    const v4Input = mergeSkillInput(legacyLocalPlan.input, v4State.skill_input);
    const localPlan: SophiaPlan = v4State.selected_tool && v4State.confidence >= 0.85
      ? {
          agentKey: usableTools.find((tool) => tool.id === v4State.selected_tool)?.agent ?? legacyLocalPlan.agentKey,
          toolId: v4State.selected_tool,
          input: v4Input,
          provider: "local",
          confidence: v4State.confidence,
          requiresConfirmation: v4State.confirmation_required,
          reason: `sophia_v4:${v4State.selected_skill ?? "local"}`,
        }
      : legacyLocalPlan;
    const plan = localPlan.confidence >= 0.85 || confirmation
      ? localPlan
      : await planWithGemini({ message, contextPack, tools: usableTools, fallback: localPlan });

    const plannedTool = plan.toolId ? usableTools.find((item) => item.id === plan.toolId) : null;
    cognitiveState = attachPlan(cognitiveState, plan, plannedTool?.riskLevel ?? null);

    if (!plan.toolId) {
      v4State = await completeSophiaV4Graph(v4State);
      await persistSophiaV4Artifacts(context, runId, v4State, "completed");
      const response = await respondWithoutTool(context, conversation.id, userMessage.id, runId, plan, contextPack, cognitiveState, v4State);
      return response;
    }

    if (plan.steps && plan.steps.length > 1) {
      const multiStepResponse = await executeReadOnlyPlan({
        context,
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        runId,
        plan,
        cognitiveState,
        v4State,
      });
      if (multiStepResponse) return multiStepResponse;
    }

    const tool = await assertSophiaToolAvailable(context, plan.toolId);
    const ownAttachmentIngest = tool.id === "document_ingest" && requestContext.attachments?.length;
    if (!confirmation && shouldRequireHumanConfirmation(tool.riskLevel) && !ownAttachmentIngest) {
      const pending = await savePendingAction(context, runId, tool.id, tool.riskLevel, plan.input);
      const prompt = buildConfirmationPrompt(tool.name, plan.input);
      const assistantMessage = await saveSophiaMessage({
        supabase: context.supabase,
        conversationId: conversation.id,
        organizationId: context.organizationId,
        userId: context.user.id,
        role: "assistant",
        content: prompt,
        metadata: {
          provider: plan.provider,
          agentKey: tool.agent,
          toolId: tool.id,
          requiresConfirmation: true,
          pendingActionId: pending,
        } as Json,
      });
      const confirmationState = finishCognitiveRuntime(cognitiveState, prompt);
      v4State = await completeSophiaV4Graph({
        ...v4State,
        selected_tool: tool.id,
        selected_agent: tool.agent,
        risk_level: tool.riskLevel,
        confirmation_required: true,
        final_answer: prompt,
      });
      await persistSophiaV4Artifacts(context, runId, v4State, "needs_confirmation");
      await updateRun(context, runId, "needs_confirmation", { message: prompt, toolId: tool.id, cognitiveState: confirmationState, sophiaV4: summarizeSophiaV4State(v4State) });
      return {
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        intent: tool.id,
        confidence: plan.confidence,
        provider: plan.provider,
        message: prompt,
        data: null,
        requiresConfirmation: true,
        confirmation: {
          actionName: legacyActionNameForTool(tool.id),
          params: plan.input,
        },
        conversationContext: { lastIntent: tool.id, lastSubjectType: requestContext.entityType ?? null, lastSubjectId: requestContext.entityId ?? null } as Json,
        agentKey: tool.agent,
        toolCalls: [],
      };
    }

    const toolCallId = await createToolCall(context, runId, tool.id, tool.riskLevel, plan.input);
    const result = await tool.execute(context, plan.input);
    await markToolCallExecuted(context, toolCallId, result.output ?? result.data ?? null);
    const verification = await verifySophiaV4ToolResult({ context, toolId: tool.id, result });
    const verified = verification.verified;
    cognitiveState = attachToolResult(cognitiveState, result.output ?? result.data ?? {}, verified, verification.reason);
    cognitiveState = finishCognitiveRuntime(cognitiveState, result.message);
    const executionStatus = verified ? "succeeded" : "failed";
    await finishToolCall(context, toolCallId, executionStatus, result.output ?? result.data ?? null, verified);
    v4State = await completeSophiaV4Graph({
      ...v4State,
      selected_tool: tool.id,
      selected_agent: tool.agent,
      risk_level: tool.riskLevel,
      confirmation_required: tool.riskLevel !== "read",
      confirmation_granted: Boolean(confirmation) || tool.riskLevel === "read",
      tool_result: result,
      verification_result: verification,
    });
    await persistSophiaV4Artifacts(context, runId, v4State, executionStatus);

    const assistantMessage = await saveSophiaMessage({
      supabase: context.supabase,
      conversationId: conversation.id,
      organizationId: context.organizationId,
      userId: context.user.id,
      role: "assistant",
      content: result.message,
      metadata: {
        provider: plan.provider,
        agentKey: tool.agent,
        toolId: tool.id,
        data: result.data ?? null,
        verified,
      } as Json,
    });
    await logLegacyAssistantAction(context, conversation.id, userMessage.id, tool.id, plan.input, result.output ?? result.data ?? {});
    await updateRun(context, runId, executionStatus, {
      message: result.message,
      data: result.data ?? null,
      toolId: tool.id,
      agentKey: tool.agent,
      cognitiveState,
      sophiaV4: summarizeSophiaV4State(v4State),
    });
    await saveEvent(context, "sophia.tool_executed", "sophia_run", runId, {
      toolId: tool.id,
      riskLevel: tool.riskLevel,
      status: executionStatus,
    });

    return {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      intent: tool.id,
      confidence: plan.confidence,
      provider: plan.provider,
      message: result.message,
      data: result.data ?? null,
      requiresConfirmation: result.requiresConfirmation ?? false,
      confirmation: result.confirmation ?? null,
      conversationContext: { lastIntent: tool.id, lastSubjectType: requestContext.entityType ?? null, lastSubjectId: requestContext.entityId ?? null } as Json,
      agentKey: tool.agent,
      toolCalls: [{ toolId: tool.id, status: executionStatus, verified }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Nao foi possivel executar a Sophia agora.";
    await updateRun(context, runId, "failed", { error: errorMessage });
    await saveEvent(context, "sophia.run_failed", "sophia_run", runId, { error: errorMessage });
    throw new Error(errorMessage);
  }
}

async function executeReadOnlyPlan({
  context,
  conversationId,
  userMessageId,
  runId,
  plan,
  cognitiveState,
  v4State,
}: {
  context: SophiaContext;
  conversationId: string;
  userMessageId: string;
  runId: string | null;
  plan: SophiaPlan;
  cognitiveState: CognitiveState;
  v4State: SophiaV4State;
}) {
  const steps = plan.steps ?? [];
  const tools = await Promise.all(steps.map((step) => assertSophiaToolAvailable(context, step.toolId)));
  if (!tools.length || tools.some((tool) => tool.riskLevel !== "read")) return null;

  const results: Array<{ toolId: string; message: string; data: Json }> = [];
  for (const [index, tool] of tools.entries()) {
    const step = steps[index];
    const callId = await createToolCall(context, runId, tool.id, tool.riskLevel, step.input);
    const result = await tool.execute(context, step.input);
    await markToolCallExecuted(context, callId, result.output ?? result.data ?? null);
    const verification = await verifySophiaV4ToolResult({ context, toolId: tool.id, result });
    const verified = verification.verified;
    await finishToolCall(context, callId, verified ? "succeeded" : "failed", result.output ?? result.data ?? null, verified);
    if (!verified) throw new Error(verification.reason || result.message || `A tool ${tool.name} nao retornou resultado verificavel.`);
    results.push({ toolId: tool.id, message: result.message, data: result.data ?? {} });
  }

  const message = results.map((result) => result.message).join("\n\n");
  const data = { steps: results.map((result) => ({ toolId: result.toolId, data: result.data })) } as unknown as Json;
  const finalCognitiveState = finishCognitiveRuntime(
    attachToolResult(cognitiveState, data, true, "all_read_tools_verified"),
    message,
  );
  const completedV4State = await completeSophiaV4Graph({
    ...v4State,
    selected_tool: steps[0]?.toolId ?? v4State.selected_tool,
    tool_result: { status: "ok", message, data },
    verification_result: { verified: true, reason: "all_read_tools_verified" },
  });
  await persistSophiaV4Artifacts(context, runId, completedV4State, "succeeded");
  const assistantMessage = await saveSophiaMessage({
    supabase: context.supabase,
    conversationId,
    organizationId: context.organizationId,
    userId: context.user.id,
    role: "assistant",
    content: message,
    metadata: { provider: plan.provider, agentKey: plan.agentKey, multiStep: true, data, verified: true } as Json,
  });
  await logLegacyAssistantAction(context, conversationId, userMessageId, "sophia.multi_read", plan.input, data);
  await updateRun(context, runId, "succeeded", { message, data, toolIds: steps.map((step) => step.toolId), multiStep: true, cognitiveState: finalCognitiveState, sophiaV4: summarizeSophiaV4State(completedV4State) });
  await saveEvent(context, "sophia.multi_tool_executed", "sophia_run", runId, { toolIds: steps.map((step) => step.toolId), status: "succeeded" });
  return {
    conversationId,
    messageId: assistantMessage.id,
    intent: steps[0]?.toolId,
    confidence: plan.confidence,
    provider: plan.provider,
    message,
    data,
    requiresConfirmation: false,
    confirmation: null,
    agentKey: plan.agentKey,
    toolCalls: results.map((result) => ({ toolId: result.toolId, status: "succeeded", verified: true })),
  } satisfies SophiaChatResponse;
}

function shouldRequireHumanConfirmation(riskLevel: SophiaRiskLevel) {
  return riskLevel === "internal_write" || riskLevel === "external_write" || riskLevel === "destructive";
}

function buildConfirmationPrompt(toolName: string, input: Record<string, Json>) {
  const title = typeof input.title === "string" ? input.title : typeof input.description === "string" ? input.description : null;
  return `Confirma executar "${toolName}"${title ? ` para "${title}"` : ""}?`;
}

function legacyActionNameForTool(toolId: string) {
  const mapping: Record<string, string> = {
    "services.create": "createService",
    "service_steps.complete": "completeServiceStep",
    "tasks.create_checklist_item": "createChecklistItem",
    "tasks.assign_member": "assignChecklistItem",
    "clients.create_task": "createClientTask",
    "clients.create_interaction": "createClientInteraction",
  };
  return mapping[toolId] ?? toolId;
}

async function respondWithoutTool(
  context: SophiaContext,
  conversationId: string,
  userMessageId: string,
  runId: string | null,
  plan: SophiaPlan,
  contextPack: Awaited<ReturnType<typeof resolveSophiaContext>>,
  cognitiveState: CognitiveState,
  v4State?: SophiaV4State,
): Promise<SophiaChatResponse> {
  void userMessageId;
  const hints = [
    contextPack.currentClient ? "Estou vendo o cliente aberto nesta tela." : null,
    contextPack.currentService ? "Estou vendo o servico aberto nesta tela." : null,
    contextPack.documents.length ? `Encontrei ${contextPack.documents.length} documento(s) relacionado(s).` : null,
    contextPack.memories.length ? `Encontrei ${contextPack.memories.length} memoria(s) operacional(is).` : null,
  ].filter(Boolean);
  const message = hints.length
    ? `Ainda nao tenho uma acao segura para executar isso automaticamente. ${hints.join(" ")}`
    : "Ainda nao entendi esse pedido com seguranca. Posso consultar servicos, clientes, tarefas, documentos e ferramentas reais do GeoGestao.";
  const assistantMessage = await saveSophiaMessage({
    supabase: context.supabase,
    conversationId,
    organizationId: context.organizationId,
    userId: context.user.id,
    role: "assistant",
    content: message,
    metadata: { provider: plan.provider, agentKey: plan.agentKey, noTool: true } as Json,
  });
  const finalCognitiveState = finishCognitiveRuntime(cognitiveState, message);
  await updateRun(context, runId, "succeeded", { message, noTool: true, cognitiveState: finalCognitiveState, sophiaV4: v4State ? summarizeSophiaV4State(v4State) : null });
  return {
    conversationId,
    messageId: assistantMessage.id,
    intent: "unknown",
    confidence: plan.confidence,
    provider: plan.provider,
    message,
    data: null,
    requiresConfirmation: false,
    confirmation: null,
    agentKey: plan.agentKey,
    toolCalls: [],
  };
}

type UntypedSupabase = {
  from(table: string): UntypedTable;
};
type UntypedTable = {
  insert(value: Record<string, unknown>): {
    select(columns: string): {
      maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
    };
  };
  update(value: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: { message: string } | null }>;
  };
};

function untyped(context: SophiaContext) {
  return context.supabase as unknown as UntypedSupabase;
}

async function createRun(
  context: SophiaContext,
  input: { conversationId: string; traceId: string; input: Record<string, unknown> },
) {
  const { data, error } = await untyped(context)
    .from("sophia_runs")
    .insert({
      organization_id: context.organizationId,
      user_id: context.user.id,
      conversation_id: input.conversationId,
      status: "running",
      input: input.input,
      trace_id: input.traceId,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (process.env.NODE_ENV !== "production") console.warn("[sophia:runs] migration pendente", error.message);
    return null;
  }
  return typeof data?.id === "string" ? data.id : null;
}

async function updateRun(context: SophiaContext, runId: string | null, status: string, output: Record<string, unknown>) {
  if (!runId) return;
  await untyped(context)
    .from("sophia_runs")
    .update({
      status,
      output,
      summary: typeof output.message === "string" ? output.message : typeof output.error === "string" ? output.error : null,
      finished_at: status === "running" ? null : new Date().toISOString(),
    })
    .eq("id", runId);
}

async function createToolCall(context: SophiaContext, runId: string | null, toolId: string, riskLevel: SophiaRiskLevel, input: Record<string, Json>) {
  const { data, error } = await untyped(context)
    .from("sophia_tool_calls")
    .insert({
      run_id: runId,
      organization_id: context.organizationId,
      user_id: context.user.id,
      tool_id: toolId,
      risk_level: riskLevel,
      input,
      status: "running",
      lifecycle_status: "requested",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return typeof data?.id === "string" ? data.id : null;
}

async function finishToolCall(
  context: SophiaContext,
  toolCallId: string | null,
  status: string,
  output: Json | null | undefined,
  verified: boolean,
) {
  if (!toolCallId) return;
  await untyped(context)
    .from("sophia_tool_calls")
    .update({
      status,
      output: output ?? {},
      verified,
      lifecycle_status: verified ? "verified" : "failed",
      finished_at: new Date().toISOString(),
    })
    .eq("id", toolCallId);
}

async function markToolCallExecuted(
  context: SophiaContext,
  toolCallId: string | null,
  output: Json | null | undefined,
) {
  if (!toolCallId) return;
  await untyped(context)
    .from("sophia_tool_calls")
    .update({
      output: output ?? {},
      lifecycle_status: "executed",
    })
    .eq("id", toolCallId);
}

async function savePendingAction(
  context: SophiaContext,
  runId: string | null,
  toolId: string,
  riskLevel: SophiaRiskLevel,
  input: Record<string, Json>,
) {
  const { data } = await untyped(context)
    .from("sophia_pending_actions")
    .insert({
      organization_id: context.organizationId,
      user_id: context.user.id,
      run_id: runId,
      tool_id: toolId,
      risk_level: riskLevel,
      prompt: buildConfirmationPrompt(getSophiaTool(toolId)?.name ?? toolId, input),
      input,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select("id")
    .maybeSingle();
  return typeof data?.id === "string" ? data.id : null;
}

async function saveEvent(
  context: SophiaContext,
  eventType: string,
  entityType: string,
  entityId: string | null,
  payload: Record<string, unknown>,
) {
  await (context.supabase as unknown as {
    from(table: string): { insert(value: Record<string, unknown>): Promise<{ error: { message: string } | null }> };
  })
    .from("sophia_events")
    .insert({
      organization_id: context.organizationId,
      user_id: context.user.id,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      status: "processed",
      processed_at: new Date().toISOString(),
    });
}

async function logLegacyAssistantAction(
  context: SophiaContext,
  conversationId: string,
  messageId: string,
  actionName: string,
  input: Json,
  output: Json,
) {
  await context.supabase.from("assistant_action_logs").insert({
    organization_id: context.organizationId,
    user_id: context.user.id,
    conversation_id: conversationId,
    message_id: messageId,
    action_name: actionName,
    input,
    output,
    status: "ok",
  });
}

function mergeSkillInput(legacy: Record<string, Json>, selected: Record<string, Json>) {
  const usefulSelected = Object.fromEntries(Object.entries(selected).filter(([, value]) => value !== null && value !== ""));
  return { ...legacy, ...usefulSelected } as Record<string, Json>;
}

async function persistSophiaV4Artifacts(context: SophiaContext, runId: string | null, state: SophiaV4State, status: string) {
  if (!runId) return;
  const database = context.supabase as unknown as {
    from(table: string): { insert(value: Record<string, unknown> | Array<Record<string, unknown>>): Promise<{ error: { message: string } | null }> };
  };
  const writes: Array<Promise<{ error: { message: string } | null }>> = [];
  if (state.selected_skill) {
    writes.push(database.from("sophia_skill_runs").insert({
      organization_id: context.organizationId,
      run_id: runId,
      skill_key: state.selected_skill,
      input: state.skill_input,
      output: state.tool_result?.output ?? state.tool_result?.data ?? {},
      status,
    }));
  }
  if (state.trace.length) {
    writes.push(database.from("sophia_graph_traces").insert(state.trace.map((entry) => ({
      organization_id: context.organizationId,
      run_id: runId,
      node_key: entry.node,
      input_summary: {},
      output_summary: entry.summary ?? {},
      status: entry.status,
      duration_ms: entry.duration_ms ?? 0,
    }))));
  }
  const results = await Promise.all(writes);
  const error = results.find((item) => item.error)?.error;
  if (error && process.env.NODE_ENV !== "production") console.warn("[sophia:v4] migration 059 pendente", error.message);
}
