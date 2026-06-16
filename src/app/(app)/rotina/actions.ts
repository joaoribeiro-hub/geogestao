"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { generateReminderNotifications, NOTIFICATION_ON_CONFLICT } from "@/lib/notifications/reminders";
import { routineItemSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function createRoutineItemAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = routineItemSchema.parse(formDataToObject(formData));
  const mentionIds = parseMentionIds(formData.get("mentioned_user_ids"));
  const mentionedMembers = await resolveMentionedMembers(supabase, organization.id, mentionIds);
  const sortOrder = await nextRoutineSortOrder(
    supabase,
    organization.id,
    user.id,
    parsed.routine_scope,
    parsed.routine_date,
  );

  const { data: item, error } = await supabase
    .from("routine_items")
    .insert({
      organization_id: organization.id,
      user_id: user.id,
      title: parsed.title,
      description: parsed.description,
      routine_scope: parsed.routine_scope,
      routine_date: parsed.routine_date,
      due_time: parsed.due_time,
      is_emergency: parsed.is_emergency,
      created_by: user.id,
      sort_order: sortOrder,
    })
    .select("id,title,routine_date,due_time")
    .single();
  if (error) throw new Error(error.message);

  if (parsed.routine_scope === "daily" && parsed.routine_date) {
    const { data: checklist, error: checklistError } = await supabase
      .from("daily_checklists")
      .upsert(
        {
          organization_id: organization.id,
          user_id: user.id,
          checklist_date: parsed.routine_date,
        },
        { onConflict: "organization_id,user_id,checklist_date" },
      )
      .select("id")
      .single();
    if (checklistError) throw new Error(checklistError.message);

    const { data: dailyItem, error: dailyError } = await supabase
      .from("daily_checklist_items")
      .insert({
        organization_id: organization.id,
        checklist_id: checklist.id,
        assigned_to: user.id,
        created_by: user.id,
        title: parsed.title,
        description: parsed.description,
        is_emergency: parsed.is_emergency,
        source: "self",
        due_date: parsed.routine_date,
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    if (dailyError) throw new Error(dailyError.message);

    await supabase
      .from("routine_items")
      .update({ daily_checklist_item_id: dailyItem.id })
      .eq("id", item.id)
      .eq("organization_id", organization.id);
  }

  if (mentionedMembers.length) {
    await supabase.from("routine_item_mentions").upsert(
      mentionedMembers.map((member) => ({
        organization_id: organization.id,
        routine_item_id: item.id,
        mentioned_user_id: member.id,
        mentioned_by: user.id,
        mention_text: `@${member.label}`,
      })),
      { onConflict: "organization_id,routine_item_id,mentioned_user_id" },
    );

    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", user.id)
      .maybeSingle();
    const actorName = actor?.full_name ?? actor?.email ?? "Um membro";
    const now = new Date().toISOString();
    await supabase.from("notifications").upsert(
      mentionedMembers.map((member) => ({
        organization_id: organization.id,
        recipient_user_id: member.id,
        actor_user_id: user.id,
        type: "routine_mention",
        title: "Mencao em rotina",
        message: `${actorName} mencionou voce em uma rotina: ${item.title}.`,
        entity_type: "routine_item",
        entity_id: item.id,
        action_url: `/rotina?week=${item.routine_date ?? ""}&focus=${item.id}`,
        metadata: { category: "Menções", routine_item_id: item.id, mention: true } as Json,
        scheduled_for: now,
        dedupe_key: `${organization.id}:${member.id}:routine_mention:${item.id}`,
      })),
      { onConflict: NOTIFICATION_ON_CONFLICT },
    );
  }

  if (item.routine_date && item.due_time) {
    await generateReminderNotifications(supabase, {
      organizationId: organization.id,
      reminderId: item.id,
      entityType: "routine_item",
      entityId: item.id,
      title: item.title,
      description: parsed.description,
      reminderDate: item.routine_date,
      reminderTime: item.due_time,
      recipientUserIds: [user.id],
      actorUserId: user.id,
      actionUrl: `/rotina?week=${item.routine_date}`,
      metadata: { routine_item_id: item.id, category: "Notas" },
    });
  }

  revalidatePath("/rotina");
}

function parseMentionIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((item): item is string => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item))));
  } catch {
    return [];
  }
}

async function resolveMentionedMembers(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  userIds: string[],
) {
  if (!userIds.length) return [] as Array<{ id: string; label: string }>;
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("user_id", userIds);
  if (error) throw new Error(error.message);
  const activeIds = (members ?? []).map((member) => member.user_id);
  if (!activeIds.length) return [];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .in("id", activeIds);
  if (profileError) throw new Error(profileError.message);
  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    label: profile.full_name ?? profile.email ?? "Membro",
  }));
}

async function nextRoutineSortOrder(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  userId: string,
  scope: "daily" | "weekly" | "monthly" | "annual",
  date: string | null,
) {
  let query = supabase
    .from("routine_items")
    .select("sort_order")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("routine_scope", scope)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (date) query = query.lte("routine_date", date);
  const { data } = await query;
  return Number(data?.[0]?.sort_order ?? 0) + 1000;
}

export async function toggleRoutineItemAction(itemId: string, done: boolean) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const now = done ? new Date().toISOString() : null;

  const { data: item, error } = await supabase
    .from("routine_items")
    .update({ status: done ? "done" : "open", completed_at: now })
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .select("daily_checklist_item_id")
    .single();
  if (error) throw new Error(error.message);

  if (item.daily_checklist_item_id) {
    await supabase
      .from("daily_checklist_items")
      .update({ status: done ? "done" : "open", completed_at: now })
      .eq("id", item.daily_checklist_item_id)
      .eq("organization_id", organization.id)
      .eq("assigned_to", user.id);
  }

  revalidatePath("/rotina");
}
