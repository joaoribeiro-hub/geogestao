import type { SophiaV4Agent } from "@/lib/sophia/v4/agents/types";

export const ClientAgent: SophiaV4Agent = {
  key: "clients",
  name: "ClientAgent",
  description: "Contexto e resumo operacional de clientes permitidos.",
  accepts: (skill) => skill.agent === "clients",
};
