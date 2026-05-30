"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { formDataToObject } from "@/lib/form-data";
import { agendaReminderSchema } from "@/lib/schemas";
import { canManageOrganization, getCurrentOrganizationContext } from "@/lib/organization";
import { markGoogleCalendarSyncsDeleted, syncReminderToGoogleCalendar } from "@/lib/integrations/google-calendar-sync";
import { generateReminderNotifications } from "@/lib/notifications/reminders";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createAgendaReminderAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) throw new Error("Usuario sem organizacao.");

  const raw = formDataToObject(formData) as Record<string, unknown>;
  raw.recipient_user_ids = formData.getAll("recipient_user_ids").map(String).filter(Boolean);
  const parsed = agendaReminderSchema.parse(raw);
  const isOwner = canManageOrganization({ profile: null, membership: context.membership });
  const recipients = isOwner ? parsed.recipient_user_ids : [user.id];
  if (!isOwner && !parsed.recipient_user_ids.includes(user.id)) {
    throw new Error("Apenas o proprietario pode criar lembretes para outros membros.");
  }

  const { data: reminder, error } = await supabase
    .from("agenda_reminders")
    .insert({
      organization_id: context.organization.id,
      title: parsed.title,
      description: parsed.description,
      reminder_date: parsed.reminder_date,
      reminder_time: parsed.reminder_time,
      category: parsed.category,
      custom_category: parsed.custom_category,
      recurrence: parsed.recurrence,
      created_by: user.id,
      entity_type: "agenda_reminder",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const uniqueRecipients = Array.from(new Set(recipients));
  const { error: recipientError } = await supabase.from("agenda_reminder_recipients").insert(
    uniqueRecipients.map((recipientId) => ({
      organization_id: context.organization!.id,
      reminder_id: reminder.id,
      recipient_user_id: recipientId,
    })),
  );
  if (recipientError) throw new Error(recipientError.message);

  await generateReminderNotifications(supabase, {
    organizationId: context.organization.id,
    reminderId: reminder.id,
    entityType: "agenda_reminder",
    entityId: reminder.id,
    title: parsed.title,
    description: parsed.description,
    reminderDate: parsed.reminder_date,
    reminderTime: parsed.reminder_time,
    recipientUserIds: uniqueRecipients,
    actorUserId: user.id,
    actionUrl: `/agenda?month=${parsed.reminder_date.slice(0, 7)}`,
    metadata: { reminder_id: reminder.id },
  });
  await syncReminderToGoogleCalendar(supabase, {
    organizationId: context.organization.id,
    reminderId: reminder.id,
    title: parsed.title,
    description: parsed.description,
    reminderDate: parsed.reminder_date,
    reminderTime: parsed.reminder_time,
    recipientUserIds: uniqueRecipients,
  });

  revalidatePath("/agenda");
}

export async function updateAgendaReminderAction(reminderId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) throw new Error("Usuario sem organizacao.");

  const raw = formDataToObject(formData) as Record<string, unknown>;
  raw.recipient_user_ids = formData.getAll("recipient_user_ids").map(String).filter(Boolean);
  const parsed = agendaReminderSchema.parse(raw);

  const { data: existing, error: existingError } = await supabase
    .from("agenda_reminders")
    .select("id,created_by")
    .eq("id", reminderId)
    .eq("organization_id", context.organization.id)
    .single();
  if (existingError) throw new Error(existingError.message);
  if (existing.created_by !== user.id) {
    throw new Error("Apenas quem criou o lembrete pode editar.");
  }

  const { error } = await supabase
    .from("agenda_reminders")
    .update({
      title: parsed.title,
      description: parsed.description,
      reminder_date: parsed.reminder_date,
      reminder_time: parsed.reminder_time,
      category: parsed.category,
      custom_category: parsed.custom_category,
      recurrence: parsed.recurrence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reminderId)
    .eq("organization_id", context.organization.id);
  if (error) throw new Error(error.message);

  await supabase
    .from("agenda_reminder_recipients")
    .delete()
    .eq("organization_id", context.organization.id)
    .eq("reminder_id", reminderId);

  const isOwner = canManageOrganization({ profile: null, membership: context.membership });
  const recipients = isOwner ? parsed.recipient_user_ids : [user.id];
  const uniqueRecipients = Array.from(new Set(recipients));
  if (uniqueRecipients.length) {
    const { error: recipientError } = await supabase.from("agenda_reminder_recipients").insert(
      uniqueRecipients.map((recipientId) => ({
        organization_id: context.organization!.id,
        reminder_id: reminderId,
        recipient_user_id: recipientId,
      })),
    );
    if (recipientError) throw new Error(recipientError.message);
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", context.organization.id)
    .eq("metadata->>reminder_id", reminderId)
    .is("read_at", null);

  await generateReminderNotifications(supabase, {
    organizationId: context.organization.id,
    reminderId,
    entityType: "agenda_reminder",
    entityId: reminderId,
    title: parsed.title,
    description: parsed.description,
    reminderDate: parsed.reminder_date,
    reminderTime: parsed.reminder_time,
    recipientUserIds: uniqueRecipients,
    actorUserId: user.id,
    actionUrl: `/agenda?month=${parsed.reminder_date.slice(0, 7)}`,
    metadata: { reminder_id: reminderId, category: parsed.category },
  });
  await syncReminderToGoogleCalendar(supabase, {
    organizationId: context.organization.id,
    reminderId,
    title: parsed.title,
    description: parsed.description,
    reminderDate: parsed.reminder_date,
    reminderTime: parsed.reminder_time,
    recipientUserIds: uniqueRecipients,
  });

  revalidatePath("/agenda");
}

export async function deleteAgendaReminderAction(reminderId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization) throw new Error("Usuario sem organizacao.");

  const { data: reminder, error: reminderError } = await supabase
    .from("agenda_reminders")
    .select("id,created_by")
    .eq("id", reminderId)
    .eq("organization_id", context.organization.id)
    .single();
  if (reminderError) throw new Error(reminderError.message);
  if (reminder.created_by !== user.id) {
    throw new Error("Apenas quem criou o lembrete pode apagar.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("agenda_reminders")
    .update({ canceled_at: now, updated_at: now })
    .eq("id", reminderId)
    .eq("organization_id", context.organization.id);
  if (error) throw new Error(error.message);

  await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("organization_id", context.organization.id)
    .eq("metadata->>reminder_id", reminderId)
    .is("read_at", null);
  await markGoogleCalendarSyncsDeleted(supabase, context.organization.id, reminderId);

  revalidatePath("/agenda");
}
