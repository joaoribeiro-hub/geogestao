import type { Json } from "@/types/database";
import type { SophiaContext, SophiaToolDefinition } from "@/lib/sophia/types";
import type { SophiaV4Skill } from "@/lib/sophia/v4/skill-types";

export type SophiaV4SkillAvailability = {
  available: boolean;
  reason: string;
  tool: SophiaToolDefinition | null;
};

export function checkSophiaV4SkillAvailability(input: {
  skill: SophiaV4Skill;
  context: Pick<SophiaContext, "isOwner" | "membership">;
  availableTools: SophiaToolDefinition[];
}): SophiaV4SkillAvailability {
  if (input.skill.permission_policy.owner_only && !input.context.isOwner) {
    return { available: false, reason: "owner_required", tool: null };
  }
  const role = input.context.membership?.role ?? "member";
  if (!input.skill.permission_policy.roles.includes(role)) {
    return { available: false, reason: "role_not_allowed", tool: null };
  }
  const tool = input.availableTools.find((candidate) => input.skill.required_tools.includes(candidate.id)) ?? null;
  if (!tool) return { available: false, reason: "required_tool_unavailable", tool: null };
  return { available: true, reason: "available", tool };
}

export function buildSkillRunRecord(input: {
  organizationId: string;
  runId: string | null;
  skill: SophiaV4Skill;
  skillInput: Record<string, Json>;
  output?: Json;
  status: string;
}) {
  return {
    organization_id: input.organizationId,
    run_id: input.runId,
    skill_key: input.skill.skill_key,
    input: input.skillInput,
    output: input.output ?? {},
    status: input.status,
  };
}
