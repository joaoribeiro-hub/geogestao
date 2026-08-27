import type { Json } from "@/types/database";
import type { SophiaRequestContext, SophiaRiskLevel } from "@/lib/sophia/types";

export type CognitivePhase =
  | "receive_input"
  | "classify_intent"
  | "retrieve_context"
  | "retrieve_memories"
  | "retrieve_documents"
  | "plan_action"
  | "decide_tool"
  | "require_confirmation_if_needed"
  | "execute_tool"
  | "verify_result"
  | "reflect"
  | "persist_memory"
  | "respond";

export type CognitiveState = {
  organization_id: string;
  user_id: string;
  role: string;
  screen_context: SophiaRequestContext;
  query: string;
  phase: CognitivePhase;
  intent: string | null;
  retrieved_context: Json;
  retrieved_documents: Array<Record<string, Json>>;
  memories: Array<Record<string, Json>>;
  planned_tool: string | null;
  planned_steps: Array<{ tool_id: string; input: Record<string, Json> }>;
  risk_level: SophiaRiskLevel | null;
  confirmation_required: boolean;
  tool_result: Json | null;
  verification: { verified: boolean; reason: string } | null;
  reflection: string | null;
  final_answer: string | null;
};

export function createCognitiveState(input: {
  organizationId: string;
  userId: string;
  role: string;
  query: string;
  screenContext: SophiaRequestContext;
}): CognitiveState {
  return {
    organization_id: input.organizationId,
    user_id: input.userId,
    role: input.role,
    screen_context: input.screenContext,
    query: input.query,
    phase: "receive_input",
    intent: null,
    retrieved_context: {},
    retrieved_documents: [],
    memories: [],
    planned_tool: null,
    planned_steps: [],
    risk_level: null,
    confirmation_required: false,
    tool_result: null,
    verification: null,
    reflection: null,
    final_answer: null,
  };
}

export function transitionCognitiveState(state: CognitiveState, phase: CognitivePhase, changes: Partial<CognitiveState> = {}) {
  return { ...state, ...changes, phase };
}

