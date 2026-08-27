import type { SophiaV4Agent } from "@/lib/sophia/v4/agents/types";

export const RoutineAgent: SophiaV4Agent = {
  key: "routine",
  name: "RoutineAgent",
  description: "Tarefas, checklist, briefing e revisao operacional.",
  accepts: (skill) => skill.agent === "routine",
};
