import type { SophiaV4Agent } from "@/lib/sophia/v4/agents/types";

export const FinanceAgent: SophiaV4Agent = {
  key: "finance",
  name: "FinanceAgent",
  description: "Analises financeiras restritas ao owner.",
  accepts: (skill) => skill.agent === "finance",
};

export function assertFinanceAgentAccess(isOwner: boolean) {
  if (!isOwner) throw new Error("O agente financeiro esta disponivel apenas para o owner da organizacao.");
}
