import type { SophiaToolDefinition } from "@/lib/sophia/types";
import type { SophiaV4Skill } from "@/lib/sophia/v4/skill-types";

export function routeSophiaV4Tool(skill: SophiaV4Skill | null, availableTools: SophiaToolDefinition[]) {
  if (!skill) return null;
  return availableTools.find((tool) => skill.required_tools.includes(tool.id)) ?? null;
}

export function assertNoInventedSophiaV4Tool(toolId: string | null, availableTools: SophiaToolDefinition[]) {
  if (!toolId) return null;
  const tool = availableTools.find((item) => item.id === toolId) ?? null;
  if (!tool) throw new Error(`A ferramenta ${toolId} nao existe ou nao esta disponivel para esta organizacao.`);
  return tool;
}
