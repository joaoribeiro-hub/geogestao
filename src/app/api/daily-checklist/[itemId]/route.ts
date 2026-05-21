import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

const updateItemSchema = z.object({
  status: z.enum(["open", "done"]).optional(),
  isEmergency: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const body = await request.json().catch(() => null);
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Atualizacao invalida." }, { status: 400 });

  const { data: current, error: currentError } = await supabase
    .from("daily_checklist_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .single();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 404 });
  if (current.assigned_to !== user.id && current.created_by !== user.id) {
    return NextResponse.json({ error: "Sem permissao para alterar este item." }, { status: 403 });
  }

  const update = {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(typeof parsed.data.isEmergency === "boolean" ? { is_emergency: parsed.data.isEmergency } : {}),
    ...(parsed.data.status === "done" ? { completed_at: new Date().toISOString() } : {}),
    ...(parsed.data.status === "open" ? { completed_at: null } : {}),
  };

  const { data: item, error } = await supabase
    .from("daily_checklist_items")
    .update(update)
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activityType = parsed.data.status === "done"
    ? "checklist_item_completed"
    : parsed.data.status === "open"
      ? "checklist_item_reopened"
      : parsed.data.isEmergency
        ? "checklist_item_emergency_marked"
        : "checklist_item_emergency_unmarked";

  await supabase.from("organization_activity_log").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    target_user_id: item.assigned_to,
    activity_type: activityType,
    entity_type: "daily_checklist_item",
    entity_id: item.id,
    metadata: { title: item.title },
  });

  return NextResponse.json({ item });
}
