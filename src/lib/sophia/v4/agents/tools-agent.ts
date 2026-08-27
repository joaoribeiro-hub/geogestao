import type { SophiaV4Agent } from "@/lib/sophia/v4/agents/types";

export const ToolsAgent: SophiaV4Agent = {
  key: "tools",
  name: "ToolsAgent",
  description: "Consulta modulos e jobs de ferramentas sem executar acao direta.",
  accepts: (skill) => skill.agent === "tools",
};
