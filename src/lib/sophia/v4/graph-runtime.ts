import type { Json } from "@/types/database";
import { SOPHIA_V4_NODE_ORDER, shouldRunSophiaV4Node } from "@/lib/sophia/v4/edges";
import { SOPHIA_V4_NODES, type SophiaV4NodeDependencies } from "@/lib/sophia/v4/nodes";
import type { SophiaV4NodeKey, SophiaV4State, SophiaV4TraceEntry } from "@/lib/sophia/v4/state";

export async function runSophiaV4Graph(
  initialState: SophiaV4State,
  dependencies: SophiaV4NodeDependencies = {},
  options: { startAt?: SophiaV4NodeKey; stopAfter?: SophiaV4NodeKey } = {},
) {
  let state = initialState;
  const startIndex = options.startAt ? SOPHIA_V4_NODE_ORDER.indexOf(options.startAt) : 0;
  for (const node of SOPHIA_V4_NODE_ORDER.slice(Math.max(startIndex, 0))) {
    const startedAt = new Date();
    if (!shouldRunSophiaV4Node(node, state)) {
      state = { ...state, trace: [...state.trace, trace(node, "skipped", startedAt)] };
    } else {
      try {
        state = await SOPHIA_V4_NODES[node](state, dependencies);
        state = { ...state, trace: [...state.trace, trace(node, "completed", startedAt, summarizeNode(state, node))] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "graph_node_failed";
        state = { ...state, errors: [...state.errors, message], trace: [...state.trace, trace(node, "failed", startedAt, { error: message })] };
      }
    }
    if (node === options.stopAfter) break;
  }
  return state;
}

export function runSophiaV4PlanningGraph(state: SophiaV4State, dependencies: SophiaV4NodeDependencies = {}) {
  return runSophiaV4Graph(state, dependencies, { stopAfter: "decide_response_or_tool" });
}

export function completeSophiaV4Graph(state: SophiaV4State, dependencies: SophiaV4NodeDependencies = {}) {
  return runSophiaV4Graph(state, dependencies, { startAt: "require_confirmation" });
}

function trace(node: SophiaV4NodeKey, status: SophiaV4TraceEntry["status"], startedAt: Date, summary?: Record<string, Json>): SophiaV4TraceEntry {
  const finishedAt = new Date();
  return { node, status, started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), duration_ms: finishedAt.getTime() - startedAt.getTime(), summary };
}

function summarizeNode(state: SophiaV4State, node: SophiaV4NodeKey): Record<string, Json> {
  return {
    node,
    intent: state.intent,
    selected_skill: state.selected_skill,
    selected_tool: state.selected_tool,
    selected_agent: state.selected_agent,
    confirmation_required: state.confirmation_required,
    verified: state.verification_result?.verified ?? null,
    error_count: state.errors.length,
  };
}
