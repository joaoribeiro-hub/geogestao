import type { Json } from "@/types/database";
import type { SophiaRiskLevel } from "@/lib/sophia/types";

export type SophiaV4PermissionPolicy = {
  roles: string[];
  owner_only?: boolean;
  own_data_only_for_non_owner?: boolean;
};

export type SophiaV4Skill = {
  skill_key: string;
  name: string;
  description: string;
  examples: string[];
  required_tools: string[];
  required_modules: string[];
  risk_level: SophiaRiskLevel;
  requires_confirmation: boolean;
  permission_policy: SophiaV4PermissionPolicy;
  input_schema: Record<string, Json>;
  output_schema: Record<string, Json>;
  verification_strategy: string;
  memory_policy: "none" | "episodic" | "operational" | "procedural_candidate";
  eval_cases: string[];
  agent: "documents" | "finance" | "services" | "clients" | "tools" | "routine";
};

export type SophiaV4SkillSelection = {
  skill: SophiaV4Skill | null;
  confidence: number;
  input: Record<string, Json>;
  reason: string;
};
