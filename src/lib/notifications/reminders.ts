import type { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type ReminderNotificationDraft = {
  type: "reminder_due_today" | "reminder_two_hours_before" | "reminder_one_hour_before" | "reminder_due_now";
  title: string;
  message: string;
  scheduledFor: string;
  dedupeSuffix: string;
};

type ReminderInput = {
  organizationId: string;
  reminderId: string;
  entityType: string;
  entityId: string;
  title: string;
  description?: string | null;
  reminderDate: string;
  reminderTime?: string | null;
  recipientUserIds: string[];
  actorUserId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  now?: Date;
};

const BRAZIL_TIMEZONE = "America/Sao_Paulo";
const BRAZIL_OFFSET = "-03:00";
export const NOTIFICATION_ON_CONFLICT = "organization_id,recipient_user_id,dedupe_key";

export async function generateReminderNotifications(
  supabase: ServerSupabase,
  input: ReminderInput,
) {
  const recipients = await getActiveOrganizationRecipients(
    supabase,
    input.organizationId,
    input.recipientUserIds,
  );
  if (!recipients.length) return [];

  const drafts = buildReminderNotificationDrafts(input);
  if (!drafts.length) return [];

  const payload = recipients.flatMap((recipientId) =>
    drafts.map((draft) => ({
      organization_id: input.organizationId,
      recipient_user_id: recipientId,
      actor_user_id: input.actorUserId ?? null,
      type: draft.type,
      title: draft.title,
      message: draft.message,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action_url: sanitizeInternalActionUrl(input.actionUrl),
      metadata: (input.metadata ?? {}) as Json,
      scheduled_for: draft.scheduledFor,
      dedupe_key: buildReminderDedupeKey({
        organizationId: input.organizationId,
        recipientId,
        entityType: input.entityType,
        entityId: input.entityId,
        reminderId: input.reminderId,
        reminderDate: input.reminderDate,
        notificationType: draft.type,
      }),
    })),
  );

  const { data, error } = await supabase
    .from("notifications")
    .upsert(payload, { onConflict: NOTIFICATION_ON_CONFLICT })
    .select("id,type,recipient_user_id,dedupe_key");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function syncDueReminderNotificationsForCurrentUser(
  supabase: ServerSupabase,
  {
    organizationId,
    userId,
    now = new Date(),
  }: {
    organizationId: string;
    userId: string;
    now?: Date;
  },
) {
  const today = localDateKey(now);
  const { data: recipientRows, error: recipientsError } = await supabase
    .from("agenda_reminder_recipients")
    .select("reminder_id")
    .eq("organization_id", organizationId)
    .eq("recipient_user_id", userId);
  if (recipientsError) throw new Error(recipientsError.message);
  const reminderIds = Array.from(new Set((recipientRows ?? []).map((row) => row.reminder_id)));
  if (!reminderIds.length) return;

  const { data: reminders, error: remindersError } = await supabase
    .from("agenda_reminders")
    .select("*")
    .eq("organization_id", organizationId)
    .lte("reminder_date", today)
    .in("id", reminderIds);
  if (remindersError) throw new Error(remindersError.message);

  for (const reminder of reminders ?? []) {
    const reminderDate = resolveReminderDateForSync(
      reminder.reminder_date,
      "recurrence" in reminder ? String(reminder.recurrence) : "none",
      today,
    );
    if (!reminderDate) continue;
    await generateReminderNotifications(supabase, {
      organizationId,
      reminderId: reminder.id,
      entityType: reminder.entity_type ?? "agenda_reminder",
      entityId: reminder.entity_id ?? reminder.id,
      title: reminder.title,
      description: reminder.description,
      reminderDate,
      reminderTime: reminder.reminder_time,
      recipientUserIds: [userId],
      actorUserId: reminder.created_by,
      actionUrl: buildReminderActionUrl(reminder),
      now,
    });
  }
}

export function buildReminderNotificationDrafts(input: Omit<ReminderInput, "recipientUserIds" | "actorUserId" | "organizationId">) {
  const now = input.now ?? new Date();
  const drafts: ReminderNotificationDraft[] = [];
  const today = localDateKey(now);
  if (input.reminderDate <= today) {
    drafts.push({
      type: "reminder_due_today",
      title: "Lembrete para hoje",
      message: buildReminderMessage(input.title, input.description, input.reminderTime),
      scheduledFor: localDateTimeToIso(input.reminderDate, "00:00"),
      dedupeSuffix: "today",
    });
  }

  if (!input.reminderTime) return drafts;

  const reminderAt = new Date(localDateTimeToIso(input.reminderDate, input.reminderTime));
  const twoHoursBefore = new Date(reminderAt.getTime() - 2 * 60 * 60 * 1000);
  const oneHourBefore = new Date(reminderAt.getTime() - 60 * 60 * 1000);
  drafts.push(
    {
      type: "reminder_two_hours_before",
      title: "Lembrete em 2 horas",
      message: `Lembrete em 2 horas: ${input.title}.`,
      scheduledFor: twoHoursBefore.toISOString(),
      dedupeSuffix: "2h",
    },
    {
      type: "reminder_one_hour_before",
      title: "Lembrete em 1 hora",
      message: `Lembrete em 1 hora: ${input.title}.`,
      scheduledFor: oneHourBefore.toISOString(),
      dedupeSuffix: "1h",
    },
    {
      type: "reminder_due_now",
      title: "Esta na hora",
      message: `Esta na hora: ${input.title}.`,
      scheduledFor: reminderAt.toISOString(),
      dedupeSuffix: "now",
    },
  );

  return drafts;
}

export function buildReminderMessage(title: string, description?: string | null, time?: string | null) {
  const text = previewNotificationText(description || title);
  return `${text}${time ? `. Horario: ${time}.` : "."}`;
}

export function previewNotificationText(value: string, limit = 110) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, Math.max(0, limit - 3))}...` : clean;
}

export function sanitizeInternalActionUrl(value?: string | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return /^\/[A-Za-z0-9_/?=&.#%-]*$/.test(value) ? value : null;
}

export function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function splitLocalDateTime(value: string) {
  const [date, timeWithSeconds] = value.split("T");
  const time = timeWithSeconds?.slice(0, 5) || null;
  return { date, time };
}

function localDateTimeToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00${BRAZIL_OFFSET}`).toISOString();
}

function buildReminderActionUrl(reminder: {
  entity_type: string | null;
  entity_id: string | null;
  reminder_date: string;
}) {
  if (reminder.entity_type === "service_card" && reminder.entity_id) return `/servicos/${reminder.entity_id}`;
  if (reminder.entity_type === "client" && reminder.entity_id) return `/clientes/${reminder.entity_id}`;
  if (reminder.entity_type === "client_interaction" && reminder.entity_id) return null;
  const month = reminder.reminder_date.slice(0, 7);
  return `/agenda?month=${month}`;
}

function buildReminderDedupeKey({
  organizationId,
  recipientId,
  entityType,
  entityId,
  reminderId,
  reminderDate,
  notificationType,
}: {
  organizationId: string;
  recipientId: string;
  entityType: string;
  entityId: string;
  reminderId: string;
  reminderDate: string;
  notificationType: string;
}) {
  return `${organizationId}:${recipientId}:${entityType}:${entityId}:${reminderId}:${reminderDate}:${notificationType}`;
}

function resolveReminderDateForSync(firstDate: string, recurrence: string, today: string) {
  if (recurrence !== "weekly") return firstDate <= today ? firstDate : null;
  const first = new Date(`${firstDate}T00:00:00${BRAZIL_OFFSET}`);
  const current = new Date(`${today}T00:00:00${BRAZIL_OFFSET}`);
  if (first > current) return null;
  const diffDays = Math.floor((current.getTime() - first.getTime()) / 86400000);
  return diffDays % 7 === 0 ? today : null;
}

async function getActiveOrganizationRecipients(
  supabase: ServerSupabase,
  organizationId: string,
  recipientUserIds: string[],
) {
  const uniqueIds = Array.from(new Set(recipientUserIds.filter(Boolean)));
  if (!uniqueIds.length) return [];
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("user_id", uniqueIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.user_id);
}
