import type { SophiaV4Skill } from "@/lib/sophia/v4/skill-types";

export type SophiaV4AgentKey = "documents" | "finance" | "services" | "clients" | "tools" | "routine";

export type SophiaV4Agent = {
  key: SophiaV4AgentKey;
  name: string;
  description: string;
  accepts(skill: SophiaV4Skill): boolean;
};
