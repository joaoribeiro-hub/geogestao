import type { SophiaV4Agent } from "@/lib/sophia/v4/agents/types";

export const ServiceAgent: SophiaV4Agent = {
  key: "services",
  name: "ServiceAgent",
  description: "Consultas e operacoes verificadas em servicos.",
  accepts: (skill) => skill.agent === "services",
};
