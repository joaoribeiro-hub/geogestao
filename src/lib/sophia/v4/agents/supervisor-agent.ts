import type { SophiaV4Skill } from "@/lib/sophia/v4/skill-types";
import type { SophiaV4Agent } from "@/lib/sophia/v4/agents/types";
import { DocumentAgent } from "@/lib/sophia/v4/agents/document-agent";
import { FinanceAgent, assertFinanceAgentAccess } from "@/lib/sophia/v4/agents/finance-agent";
import { ServiceAgent } from "@/lib/sophia/v4/agents/service-agent";
import { ClientAgent } from "@/lib/sophia/v4/agents/client-agent";
import { ToolsAgent } from "@/lib/sophia/v4/agents/tools-agent";
import { RoutineAgent } from "@/lib/sophia/v4/agents/routine-agent";

const AGENTS: SophiaV4Agent[] = [DocumentAgent, FinanceAgent, ServiceAgent, ClientAgent, ToolsAgent, RoutineAgent];

export function routeSophiaV4Agent(skill: SophiaV4Skill | null, isOwner: boolean) {
  if (!skill) return null;
  const agent = AGENTS.find((item) => item.accepts(skill)) ?? null;
  if (agent?.key === "finance") assertFinanceAgentAccess(isOwner);
  return agent;
}

export const SupervisorAgent = {
  key: "supervisor" as const,
  name: "SupervisorAgent",
  description: "Roteia para um agente especialista; nunca executa ferramentas diretamente.",
  route: routeSophiaV4Agent,
};
