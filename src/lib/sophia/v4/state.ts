import type { Json } from "@/types/database";
import type { SophiaRequestContext, SophiaRiskLevel, SophiaToolResult } from "@/lib/sophia/types";

export type SophiaV4NodeKey =
  | "receive_input"
  | "normalize_input"
  | "resolve_identity_and_permissions"
  | "classify_intent"
  | "retrieve_screen_context"
  | "retrieve_operational_context"
  | "retrieve_memory"
  | "retrieve_documents"
  | "retrieve_module_context"
  | "plan"
  | "decide_response_or_tool"
  | "require_confirmation"
  | "execute_tool"
  | "verify_tool_result"
  | "reflect_on_result"
  | "persist_learning"
  | "compose_answer"
  | "emit_events";

export type SophiaV4TraceEntry = {
  node: SophiaV4NodeKey;
  status: "started" | "completed" | "skipped" | "failed";
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  summary?: Record<string, Json>;
};

export type SophiaV4Citation = {
  document_id: string;
  document: string;
  page: number | null;
  chunk_id: string;
  snippet: string;
  source: string;
  from_ocr: boolean;
};

export type SophiaV4VerificationResult = {
  verified: boolean;
  reason: string;
  evidence?: Json;
};

export type SophiaV4State = {
  run_id: string | null;
  organization_id: string;
  user_id: string;
  user_role: string;
  input_text: string;
  normalized_input: string;
  screen_context: SophiaRequestContext;
  intent: string | null;
  confidence: number;
  retrieved_context: Record<string, Json>;
  retrieved_documents: Array<Record<string, Json>>;
  retrieved_memories: Array<Record<string, Json>>;
  selected_skill: string | null;
  selected_tool: string | null;
  selected_agent: string | null;
  skill_input: Record<string, Json>;
  risk_level: SophiaRiskLevel | null;
  confirmation_required: boolean;
  confirmation_granted: boolean;
  confirmation_payload: Record<string, Json> | null;
  tool_result: SophiaToolResult | null;
  verification_result: SophiaV4VerificationResult | null;
  reflection: string | null;
  learned_candidates: string[];
  final_answer: string | null;
  citations: SophiaV4Citation[];
  errors: string[];
  trace: SophiaV4TraceEntry[];
};

export function createSophiaV4State(input: {
  runId?: string | null;
  organizationId: string;
  userId: string;
  userRole: string;
  inputText: string;
  screenContext?: SophiaRequestContext;
  confirmationGranted?: boolean;
  confirmationPayload?: Record<string, Json> | null;
}): SophiaV4State {
  return {
    run_id: input.runId ?? null,
    organization_id: input.organizationId,
    user_id: input.userId,
    user_role: input.userRole,
    input_text: input.inputText,
    normalized_input: "",
    screen_context: input.screenContext ?? {},
    intent: null,
    confidence: 0,
    retrieved_context: {},
    retrieved_documents: [],
    retrieved_memories: [],
    selected_skill: null,
    selected_tool: null,
    selected_agent: null,
    skill_input: {},
    risk_level: null,
    confirmation_required: false,
    confirmation_granted: input.confirmationGranted ?? false,
    confirmation_payload: input.confirmationPayload ?? null,
    tool_result: null,
    verification_result: null,
    reflection: null,
    learned_candidates: [],
    final_answer: null,
    citations: [],
    errors: [],
    trace: [],
  };
}

export function summarizeSophiaV4State(state: SophiaV4State): Record<string, Json> {
  return {
    intent: state.intent,
    confidence: state.confidence,
    selected_skill: state.selected_skill,
    selected_tool: state.selected_tool,
    selected_agent: state.selected_agent,
    risk_level: state.risk_level,
    confirmation_required: state.confirmation_required,
    verified: state.verification_result?.verified ?? null,
    citations: state.citations.length,
    errors: state.errors.slice(0, 5),
    trace: state.trace.map((entry) => ({
      node: entry.node,
      status: entry.status,
      duration_ms: entry.duration_ms ?? null,
    })),
  };
}
