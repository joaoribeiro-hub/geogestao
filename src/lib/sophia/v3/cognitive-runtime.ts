import type { Json } from "@/types/database";
import type { SophiaContextPack, SophiaPlan, SophiaRiskLevel } from "@/lib/sophia/types";
import { createCognitiveState, transitionCognitiveState, type CognitiveState } from "@/lib/sophia/v3/cognitive-state";

export function startCognitiveRuntime(input: {
  organizationId: string;
  userId: string;
  role: string;
  query: string;
  screenContext: import("@/lib/sophia/types").SophiaRequestContext;
}) {
  return createCognitiveState(input);
}

export function attachRetrievedContext(state: CognitiveState, context: SophiaContextPack) {
  return transitionCognitiveState(state, "retrieve_documents", {
    retrieved_context: {
      screen: context.screen,
      currentClient: context.currentClient,
      currentService: context.currentService,
      recentMessages: context.recentMessages,
    } as Json,
    memories: context.memories as Array<Record<string, Json>>,
    retrieved_documents: context.documents as Array<Record<string, Json>>,
  });
}

export function attachPlan(state: CognitiveState, plan: SophiaPlan, riskLevel: SophiaRiskLevel | null) {
  const steps = plan.steps?.length
    ? plan.steps.map((step) => ({ tool_id: step.toolId, input: step.input }))
    : plan.toolId
      ? [{ tool_id: plan.toolId, input: plan.input }]
      : [];
  return transitionCognitiveState(state, "require_confirmation_if_needed", {
    intent: plan.toolId,
    planned_tool: plan.toolId,
    planned_steps: steps,
    risk_level: riskLevel,
    confirmation_required: plan.requiresConfirmation,
  });
}

export function attachToolResult(state: CognitiveState, result: Json, verified: boolean, reason: string) {
  return transitionCognitiveState(state, "reflect", {
    tool_result: result,
    verification: { verified, reason },
  });
}

export function finishCognitiveRuntime(state: CognitiveState, answer: string, reflection?: string | null) {
  return transitionCognitiveState(state, "respond", {
    final_answer: answer,
    reflection: reflection ?? state.reflection,
  });
}

