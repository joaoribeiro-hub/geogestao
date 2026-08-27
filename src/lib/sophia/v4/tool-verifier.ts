import type { Json } from "@/types/database";
import type { SophiaContext, SophiaToolResult } from "@/lib/sophia/types";
import type { SophiaV4VerificationResult } from "@/lib/sophia/v4/state";

export async function verifySophiaV4ToolResult(input: {
  context?: SophiaContext;
  toolId: string;
  result: SophiaToolResult;
}): Promise<SophiaV4VerificationResult> {
  if (input.result.status === "error") return { verified: false, reason: "handler_returned_error" };
  if (input.result.status === "needs_confirmation" || input.result.requiresConfirmation) {
    return { verified: false, reason: "confirmation_still_required" };
  }
  if (!input.result.message?.trim()) return { verified: false, reason: "empty_handler_message" };
  if (!input.context) return { verified: Boolean(input.result.output ?? input.result.data), reason: "handler_output_only" };

  const payload = asObject(input.result.data ?? input.result.output);
  if (input.toolId === "service_steps.complete") {
    const checklistItemId = stringValue(payload?.checklistItemId ?? payload?.checklist_item_id);
    if (!checklistItemId) return { verified: false, reason: "missing_checklist_item_id" };
    const { data, error } = await input.context.supabase.from("checklist_items").select("id,is_done,completed_at,checklists!inner(organization_id)").eq("id", checklistItemId).eq("checklists.organization_id", input.context.organizationId).maybeSingle();
    return { verified: !error && data?.is_done === true && Boolean(data.completed_at), reason: error ? "database_verification_failed" : "checklist_item_reloaded", evidence: data as unknown as Json };
  }
  if (input.toolId === "tasks.create_checklist_item") {
    const itemId = stringValue(payload?.item_id ?? asObject(payload?.item)?.id);
    if (!itemId) return { verified: false, reason: "missing_task_id" };
    const { data, error } = await input.context.supabase.from("daily_checklist_items").select("id,organization_id,status").eq("id", itemId).eq("organization_id", input.context.organizationId).maybeSingle();
    return { verified: !error && Boolean(data), reason: error ? "database_verification_failed" : "task_reloaded", evidence: data as unknown as Json };
  }
  if (input.toolId === "services.update_due_date") {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) return { verified: false, reason: "missing_updated_services" };
    const ids = items.map((item) => stringValue(asObject(item)?.id)).filter((item): item is string => Boolean(item));
    const { data, error } = await input.context.supabase.from("service_cards").select("id,due_date").eq("organization_id", input.context.organizationId).in("id", ids);
    return { verified: !error && (data?.length ?? 0) === ids.length, reason: error ? "database_verification_failed" : "services_reloaded", evidence: (data ?? []) as unknown as Json };
  }
  return { verified: true, reason: "read_or_handler_result_validated", evidence: (input.result.output ?? input.result.data ?? {}) as Json };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
