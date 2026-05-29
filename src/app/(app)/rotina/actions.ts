"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { generateReminderNotifications } from "@/lib/notifications/reminders";
import { routineItemSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createRoutineItemAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = routineItemSchema.parse(formDataToObject(formData));

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
