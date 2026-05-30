import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncReminderToGoogleCalendar } from "@/lib/integrations/google-calendar-sync";
import { NOTIFICATION_ON_CONFLICT } from "@/lib/notifications/reminders";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type NotificationPreference = "due" | "10m" | "1h" | "none";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ reminders: [], members: [] });
  const date = new URL(request.url).searchParams.get("date") ?? localDateKey();

  const [{ data: memberships }, { data: recipientRows }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", organization.id)
      .eq("status", "active"),
    supabase
      .from("agenda_reminder_recipients")
      .select("reminder_id")
      .eq("organization_id", organization.id)
      .eq("recipient_user_id", user.id),
  ]);

  const memberIds = (memberships ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", memberIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const members = (memberships ?? []).map((member) => ({
    id: member.user_id,
    label: profileMap.get(member.user_id)?.full_name ?? profileMap.get(member.user_id)?.email ?? member.role ?? "Membro",
  }));

  const reminderIds = Array.from(new Set((recipientRows ?? []).map((row) => row.reminder_id)));
  const { data: reminders } = reminderIds.length
    ? await supabase
        .from("agenda_reminders")
        .select("id,title,description,reminder_date,reminder_time,created_by,notification_preference,completed_at,canceled_at")
        .eq("organization_id", organization.id)
        .eq("reminder_date", date)
        .in("id", reminderIds)
        .is("canceled_at", null)
        .order("reminder_time", { ascending: true, nullsFirst: false })
    : { data: [] };

  return NextResponse.json({ reminders: reminders ?? [], members });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    date?: string;
    time?: string | null;
    recipientUserIds?: string[];
    notificationPreference?: NotificationPreference;
  } | null;

  const title = body?.title?.trim();
  const date = body?.date?.trim();
  const time = body?.time?.trim() || null;
  const preference = isNotificationPreference(body?.notificationPreference)
    ? body.notificationPreference
    : "due";
  if (!title || !date) {
    return NextResponse.json({ error: "Informe titulo e data do lembrete." }, { status: 400 });
  }

  const requestedRecipients = body?.recipientUserIds?.length ? body.recipientUserIds : [user.id];
  const { data: activeMembers, error: memberError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organization.id)
    .eq("status", "active")
    .in("user_id", Array.from(new Set(requestedRecipients)));
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
  const recipientUserIds = Array.from(new Set((activeMembers ?? []).map((member) => member.user_id)));
  if (!recipientUserIds.length) {
    return NextResponse.json({ error: "Nenhum destinatario valido nesta empresa." }, { status: 400 });
  }

  const { data: reminder, error } = await supabase
    .from("agenda_reminders")
    .insert({
      organization_id: organization.id,
      title,
      reminder_date: date,
      reminder_time: time,
      category: "Outro",
      custom_category: "Lembrete rapido",
      recurrence: "none",
      created_by: user.id,
      entity_type: "quick_reminder",
      notification_preference: preference,
    })
    .select("id,title,reminder_date,reminder_time")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: recipientError } = await supabase.from("agenda_reminder_recipients").insert(
    recipientUserIds.map((recipientId) => ({
      organization_id: organization.id,
      reminder_id: reminder.id,
      recipient_user_id: recipientId,
    })),
  );
  if (recipientError) return NextResponse.json({ error: recipientError.message }, { status: 500 });

  if (preference !== "none") {
    const notifications = recipientUserIds.map((recipientId) => ({
      organization_id: organization.id,
      recipient_user_id: recipientId,
      actor_user_id: user.id,
      type: "quick_reminder",
      title: "Lembrete",
      message: buildQuickReminderMessage(title, date, time, preference),
      entity_type: "quick_reminder",
      entity_id: reminder.id,
      action_url: `/agenda?month=${date.slice(0, 7)}`,
      metadata: { reminder_id: reminder.id, category: "Notas", notification_preference: preference } as Json,
      scheduled_for: scheduledFor(date, time, preference),
      dedupe_key: `${organization.id}:${recipientId}:quick_reminder:${reminder.id}:${preference}`,
    }));
    await supabase.from("notifications").upsert(notifications, { onConflict: NOTIFICATION_ON_CONFLICT });
  }

  await syncReminderToGoogleCalendar(supabase, {
    organizationId: organization.id,
    reminderId: reminder.id,
    title,
    reminderDate: date,
    reminderTime: time,
    recipientUserIds,
  });

  return NextResponse.json({ reminder });
}

function isNotificationPreference(value: unknown): value is NotificationPreference {
  return value === "due" || value === "10m" || value === "1h" || value === "none";
}

function buildQuickReminderMessage(title: string, date: string, time: string | null, preference: NotificationPreference) {
  const suffix = time ? ` as ${time}` : "";
  if (preference === "10m") return `Em 10 minutos: ${title}${suffix}.`;
  if (preference === "1h") return `Em 1 hora: ${title}${suffix}.`;
  return `Lembrete: ${title} em ${date}${suffix}.`;
}

function scheduledFor(date: string, time: string | null, preference: NotificationPreference) {
  const base = new Date(`${date}T${time || "00:00"}:00-03:00`);
  if (preference === "10m") base.setMinutes(base.getMinutes() - 10);
  if (preference === "1h") base.setHours(base.getHours() - 1);
  return base.toISOString();
}

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}
