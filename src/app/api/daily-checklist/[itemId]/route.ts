import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { NOTIFICATION_ON_CONFLICT } from "@/lib/notifications/reminders";
import { createServerSupabase } from "@/lib/supabase/server";

const updateItemSchema = z.object({
  status: z.enum(["open", "done"]).optional(),
  isEmergency: z.boolean().optional(),
  title: z.string().trim().min(2).max(240).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
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
    ...(parsed.data.title ? { title: parsed.data.title } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    ...(parsed.data.dueDate ? { due_date: parsed.data.dueDate } : {}),
    ...(typeof parsed.data.sortOrder === "number" ? { sort_order: parsed.data.sortOrder } : {}),
    ...(parsed.data.status === "done" ? { completed_at: new Date().toISOString() } : {}),
    ...(parsed.data.status === "open" ? { completed_at: null } : {}),
  };

  const { data: itemRows, error } = await supabase
    .from("daily_checklist_items")
    .update(update)
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .select("*")
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const item = itemRows?.[0];
  if (!item) return NextResponse.json({ error: "Item nao retornado apos atualizacao." }, { status: 500 });

  const routineUpdate = {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(typeof parsed.data.isEmergency === "boolean" ? { is_emergency: parsed.data.isEmergency } : {}),
    ...(parsed.data.title ? { title: parsed.data.title } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    ...(parsed.data.dueDate ? { routine_date: parsed.data.dueDate } : {}),
    ...(typeof parsed.data.sortOrder === "number" ? { sort_order: parsed.data.sortOrder } : {}),
    ...(parsed.data.status === "done" ? { completed_at: item.completed_at } : {}),
    ...(parsed.data.status === "open" ? { completed_at: null } : {}),
  };
  await supabase
    .from("routine_items")
    .update(routineUpdate)
    .eq("organization_id", organization.id)
    .eq("daily_checklist_item_id", item.id);

  const activityType = parsed.data.status === "done"
    ? "checklist_item_completed"
    : parsed.data.status === "open"
      ? "checklist_item_reopened"
      : typeof parsed.data.isEmergency === "boolean"
        ? parsed.data.isEmergency
          ? "checklist_item_emergency_marked"
          : "checklist_item_emergency_unmarked"
        : "checklist_item_updated";

  await supabase.from("organization_activity_log").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    target_user_id: item.assigned_to,
    activity_type: activityType,
    entity_type: "daily_checklist_item",
    entity_id: item.id,
    metadata: { title: item.title },
  });

  if (parsed.data.status === "done") {
    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const { data: owners } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization.id)
      .eq("status", "active")
      .eq("role", "owner")
      .neq("user_id", user.id);
    const actorName = actor?.full_name || "Um membro";
    const now = new Date().toISOString();
    const notifications = (owners ?? []).map((owner) => ({
      organization_id: organization.id,
      recipient_user_id: owner.user_id,
      actor_user_id: user.id,
      type: "daily_checklist_completed",
      title: "Checklist concluido",
      message: `${actorName} concluiu ${item.title}.`,
      entity_type: "daily_checklist_item",
      entity_id: item.id,
      action_url: "/?checklist=today",
      metadata: { checklist_item_id: item.id, title: item.title },
      scheduled_for: now,
      dedupe_key: `daily-checklist:${item.id}:${owner.user_id}:${now.slice(0, 16)}`,
    }));
    if (notifications.length) {
      await supabase.from("notifications").upsert(notifications, { onConflict: NOTIFICATION_ON_CONFLICT });
    }
  }

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data: current, error: currentError } = await supabase
    .from("daily_checklist_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .single();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 404 });
  if (current.assigned_to !== user.id && current.created_by !== user.id) {
    return NextResponse.json({ error: "Sem permissao para apagar este item." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data: itemRows, error } = await supabase
    .from("daily_checklist_items")
    .update({ status: "canceled", deleted_at: now })
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .select("*")
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const item = itemRows?.[0];
  if (!item) return NextResponse.json({ error: "Item nao retornado apos exclusao." }, { status: 500 });

  await supabase
    .from("routine_items")
    .update({ status: "canceled", deleted_at: now })
    .eq("organization_id", organization.id)
    .eq("daily_checklist_item_id", item.id);

  await supabase.from("organization_activity_log").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    target_user_id: item.assigned_to,
    activity_type: "checklist_item_deleted",
    entity_type: "daily_checklist_item",
    entity_id: item.id,
    metadata: { title: item.title },
  });

  return NextResponse.json({ item });
}
