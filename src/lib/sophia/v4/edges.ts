import type { SophiaV4NodeKey, SophiaV4State } from "@/lib/sophia/v4/state";

export const SOPHIA_V4_NODE_ORDER: SophiaV4NodeKey[] = [
  "receive_input",
  "normalize_input",
  "resolve_identity_and_permissions",
  "classify_intent",
  "retrieve_screen_context",
  "retrieve_operational_context",
  "retrieve_memory",
  "retrieve_documents",
  "retrieve_module_context",
  "plan",
  "decide_response_or_tool",
  "require_confirmation",
  "execute_tool",
  "verify_tool_result",
  "reflect_on_result",
  "persist_learning",
  "compose_answer",
  "emit_events",
];

export function shouldRunSophiaV4Node(node: SophiaV4NodeKey, state: SophiaV4State) {
  if (node === "execute_tool") {
    return Boolean(state.selected_tool) && (!state.confirmation_required || state.confirmation_granted);
  }
  if (node === "verify_tool_result") return Boolean(state.tool_result);
  if (node === "retrieve_documents") {
    return state.selected_agent === "documents" || /\b(documento|arquivo|pdf|contrato|matricula)\b/.test(state.normalized_input);
  }
  return true;
}
