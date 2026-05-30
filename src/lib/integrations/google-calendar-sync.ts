import {
  createGoogleCalendarEvent,
  getFreshGoogleAccessToken,
  getGoogleIntegrationForUser,
} from "@/lib/integrations/google";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export async function syncReminderToGoogleCalendar(
  supabase: ServerSupabase,
  {
    organizationId,
    reminderId,
    title,
    description,
    reminderDate,
    reminderTime,
    recipientUserIds,
  }: {
    organizationId: string;
    reminderId: string;
    title: string;
    description?: string | null;
    reminderDate: string;
    reminderTime?: string | null;
    recipientUserIds: string[];
  },
) {
  const recipients = Array.from(new Set(recipientUserIds.filter(Boolean)));
  for (const recipientId of recipients) {
    const existingSync = await getExistingSync(supabase, organizationId, reminderId, recipientId);
    if (existingSync?.sync_status === "synced" && existingSync.external_event_id) continue;

    const integration = await getGoogleIntegrationForUser({
      supabase,
      userId: recipientId,
      organizationId,
      provider: "google_calendar",
    });

    if (!integration || integration.status !== "active") {
      await upsertSync(supabase, {
        organizationId,
        reminderId,
        recipientId,
        syncStatus: "skipped",
        lastError: "Usuario sem Google Calendar conectado.",
      });
      continue;
    }

    try {
      const accessToken = await getFreshGoogleAccessToken(supabase, integration);
      const event = await createGoogleCalendarEvent({
        accessToken,
        title,
        description,
        date: reminderDate,
        time: reminderTime,
      });
      await upsertSync(supabase, {
        organizationId,
        reminderId,
        recipientId,
        syncStatus: "synced",
        externalEventId: event.id,
        lastError: null,
      });
    } catch (error) {
      await upsertSync(supabase, {
        organizationId,
        reminderId,
        recipientId,
        syncStatus: "error",
        lastError: error instanceof Error ? error.message : "Falha ao sincronizar Google Calendar.",
      });
    }
  }
}

export async function markGoogleCalendarSyncsDeleted(
  supabase: ServerSupabase,
  organizationId: string,
  reminderId: string,
) {
  await supabase
    .from("calendar_event_syncs")
    .update({ sync_status: "deleted", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("internal_event_id", reminderId)
    .eq("provider", "google_calendar");
}

async function getExistingSync(
  supabase: ServerSupabase,
  organizationId: string,
  reminderId: string,
  recipientId: string,
) {
  const { data } = await supabase
    .from("calendar_event_syncs")
    .select("id,sync_status,external_event_id")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", reminderId)
    .eq("user_id", recipientId)
    .eq("provider", "google_calendar")
    .maybeSingle();
  return data;
}

async function upsertSync(
  supabase: ServerSupabase,
  {
    organizationId,
    reminderId,
    recipientId,
    syncStatus,
    externalEventId,
    lastError,
  }: {
    organizationId: string;
    reminderId: string;
    recipientId: string;
    syncStatus: "pending" | "synced" | "error" | "skipped" | "deleted";
    externalEventId?: string | null;
    lastError?: string | null;
  },
) {
  await supabase.from("calendar_event_syncs").upsert(
    {
      organization_id: organizationId,
      internal_event_id: reminderId,
      user_id: recipientId,
      provider: "google_calendar",
      external_event_id: externalEventId ?? null,
      sync_status: syncStatus,
      last_error: lastError ?? null,
      synced_at: syncStatus === "synced" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,internal_event_id,user_id,provider" },
  );
}
