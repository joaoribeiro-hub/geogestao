import type { SophiaV4Agent } from "@/lib/sophia/v4/agents/types";

export const DocumentAgent: SophiaV4Agent = {
  key: "documents",
  name: "DocumentAgent",
  description: "Busca, ingestao e respostas documentais com evidencia.",
  accepts: (skill) => skill.agent === "documents",
};
