import { createSophiaV4State } from "@/lib/sophia/v4/state";
import { runSophiaV4PlanningGraph } from "@/lib/sophia/v4/graph-runtime";
import type { SophiaToolDefinition } from "@/lib/sophia/types";
import { scorePermissionSafety, scoreToolSelection } from "@/lib/sophia/v4/evals/scoring";

export type SophiaV4EvalCase = {
  title: string;
  input: string;
  expectedTool: string | null;
  expectedSkill?: string | null;
  role?: string;
};

export async function runSophiaEvalCase(evalCase: SophiaV4EvalCase, availableTools: SophiaToolDefinition[]) {
  const state = createSophiaV4State({ organizationId: "eval-org", userId: "eval-user", userRole: evalCase.role ?? "owner", inputText: evalCase.input });
  const result = await runSophiaV4PlanningGraph(state, { availableTools, isOwner: (evalCase.role ?? "owner") === "owner" });
  const toolScore = scoreToolSelection(result.selected_tool, evalCase.expectedTool);
  const skillScore = evalCase.expectedSkill === undefined ? 1 : Number(result.selected_skill === evalCase.expectedSkill);
  const permissionScore = scorePermissionSafety({ allowed: !result.errors.some((item) => item.includes("owner")), executed: Boolean(result.tool_result) });
  return { state: result, score: (toolScore + skillScore + permissionScore) / 3, toolScore, skillScore, permissionScore };
}

export async function runSophiaEvalSuite(cases: SophiaV4EvalCase[], availableTools: SophiaToolDefinition[]) {
  const results = [];
  for (const evalCase of cases) results.push({ title: evalCase.title, ...(await runSophiaEvalCase(evalCase, availableTools)) });
  return { results, score: results.length ? results.reduce((sum, item) => sum + item.score, 0) / results.length : 0 };
}
