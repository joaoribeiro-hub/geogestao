import { getSophiaToolRegistry } from "@/lib/sophia/tool-registry";
import type { SophiaContext, SophiaToolDefinition } from "@/lib/sophia/types";

export type SophiaToolAvailability = {
  tool: SophiaToolDefinition;
  status: "available" | "blocked" | "unavailable";
  reason?: string;
};

type ModuleAccessRow = {
  module_key: string;
  enabled: boolean | null;
  status?: string | null;
  access_state?: string | null;
  billing_mode?: string | null;
  expires_at?: string | null;
  access_expires_at?: string | null;
};

export async function getAvailableSophiaTools(context: SophiaContext) {
  const moduleAccess = await loadModuleAccess(context);
  const role = context.membership?.role ?? "member";

  return getSophiaToolRegistry().map((tool): SophiaToolAvailability => {
    if (tool.allowedRoles?.length && !tool.allowedRoles.includes(role)) {
      return { tool, status: "blocked", reason: "role_blocked" };
    }
    if (tool.id.startsWith("finance.") && !context.isOwner) {
      return { tool, status: "blocked", reason: "owner_only" };
    }
    if (tool.moduleKey) {
      const access = moduleAccess.get(tool.moduleKey);
      if (!access) return { tool, status: "unavailable", reason: "module_not_registered" };
      if (access.enabled === false || access.status === "blocked" || access.access_state === "blocked") {
        return { tool, status: "blocked", reason: "module_blocked" };
      }
      const expiresAt = access.access_expires_at ?? access.expires_at;
      if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        return { tool, status: "blocked", reason: "module_expired" };
      }
    }
    return { tool, status: "available" };
  });
}

export async function assertSophiaToolAvailable(context: SophiaContext, toolId: string) {
  const available = await getAvailableSophiaTools(context);
  const match = available.find((item) => item.tool.id === toolId);
  if (!match || match.status !== "available") {
    throw new Error("Ferramenta indisponivel para este usuario ou organizacao.");
  }
  return match.tool;
}

async function loadModuleAccess(context: SophiaContext) {
  const supabase = context.supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: string): Promise<{ data: ModuleAccessRow[] | null; error: { message: string } | null }>;
      };
    };
  };
  const { data, error } = await supabase
    .from("organization_modules")
    .select("module_key,enabled,status,access_state,billing_mode,expires_at,access_expires_at")
    .eq("organization_id", context.organizationId);
  if (error) return new Map<string, ModuleAccessRow>();
  return new Map((data ?? []).map((row) => [row.module_key, row]));
}
