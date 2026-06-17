import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import {
  addSeconds,
  continuousSecondsBetween,
  getSaoPauloDateKey,
  getSaoPauloDayStartIso,
  getSaoPauloNextDayStartIso,
  HEARTBEAT_MAX_DELTA_SECONDS,
  MISSED_HEARTBEAT_FREEZE_SECONDS,
  SAFETY_GRACE_SECONDS,
  SAFETY_INTERVAL_SECONDS,
  safetyState,
  secondsBetween,
  type WorkDayStatus,
  type WorkMode,
} from "@/lib/services/work-time";
import { createServerSupabase } from "@/lib/supabase/server";
import type { WorkTimeDay, WorkTimeSession } from "@/types/database";

type WorkAction = "heartbeat" | "toggle_interval" | "toggle_field" | "confirm_safety";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const status = await ensureTodayWorkDay({ supabase, organizationId: organization.id, userId: user.id });
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { action?: WorkAction };
  const action = body.action ?? "heartbeat";

  const ensured = await ensureTodayWorkDay({
    supabase,
    organizationId: organization.id,
    userId: user.id,
    eventType: action === "heartbeat" ? "heartbeat" : undefined,
  });

  if (action === "toggle_interval") {
    return NextResponse.json(
      await toggleInterval({
        supabase,
        organizationId: organization.id,
        userId: user.id,
        day: ensured.day,
      }),
    );
  }

  if (action === "toggle_field") {
    return NextResponse.json(
      await toggleField({
        supabase,
        organizationId: organization.id,
        userId: user.id,
        day: ensured.day,
      }),
    );
  }

  if (action === "confirm_safety") {
    return NextResponse.json(
      await confirmSafety({
        supabase,
        organizationId: organization.id,
        userId: user.id,
        day: ensured.day,
      }),
    );
  }

  return NextResponse.json(ensured);
}

async function ensureTodayWorkDay({
  supabase,
  organizationId,
  userId,
  eventType,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  eventType?: string;
}) {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = getSaoPauloDateKey(now);
  const oldDays = await closeOldOpenDays({ supabase, organizationId, userId, today, nowIso });

  const { data: existing, error: existingError } = await supabase
    .from("work_time_days")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("work_date", today)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  let day = existing;
  if (!day) {
    const resumeFieldFromIso = oldDays.resumeField ? getSaoPauloDayStartIso(today) : null;
    const startedAtIso = resumeFieldFromIso ?? nowIso;
    const initialStatus: WorkDayStatus = resumeFieldFromIso ? "field_mode" : "active";
    const nextSafety = addSeconds(now, SAFETY_INTERVAL_SECONDS);
    const { data: created, error } = await supabase
      .from("work_time_days")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        work_date: today,
        status: initialStatus,
        first_started_at: startedAtIso,
        last_seen_at: startedAtIso,
        last_safety_confirmed_at: nowIso,
        next_safety_due_at: nextSafety.toISOString(),
        safety_grace_until: addSeconds(nextSafety, SAFETY_GRACE_SECONDS).toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    day = created;
    await startSession({
      supabase,
      organizationId,
      userId,
      dayId: day.id,
      mode: resumeFieldFromIso ? "field" : "work",
      nowIso: startedAtIso,
    });
    await logEvent({
      supabase,
      organizationId,
      userId,
      dayId: day.id,
      eventType: resumeFieldFromIso ? "field_started" : "work_started",
      nowIso: startedAtIso,
    });
  }

  day = await applyHeartbeat({ supabase, organizationId, userId, day, now });
  if (eventType) {
    await logEvent({ supabase, organizationId, userId, dayId: day.id, eventType, nowIso });
  }
  return buildStatus(day);
}

async function applyHeartbeat({
  supabase,
  organizationId,
  userId,
  day,
  now,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  day: WorkTimeDay;
  now: Date;
}) {
  const nowIso = now.toISOString();
  const state = safetyState(day, now);
  const mode = statusToMode(day.status);
  const secondsSinceLastSeen = continuousSecondsBetween(day.last_seen_at, nowIso);
  let delta =
    mode === "field"
      ? secondsSinceLastSeen
      : secondsBetween(day.last_seen_at, nowIso, HEARTBEAT_MAX_DELTA_SECONDS);
  let status = day.status;
  let safetyFrozenEvent = false;

  if (
    (state.isFrozen || secondsSinceLastSeen > MISSED_HEARTBEAT_FREEZE_SECONDS) &&
    day.status === "active"
  ) {
    const untilFreeze = secondsBetween(day.last_seen_at, day.safety_grace_until, HEARTBEAT_MAX_DELTA_SECONDS);
    delta = state.isFrozen ? untilFreeze : HEARTBEAT_MAX_DELTA_SECONDS;
    status = "safety_frozen";
    safetyFrozenEvent = true;
  }

  const workDelta = mode === "work" || mode === "field" ? delta : 0;
  const intervalDelta = mode === "interval" ? delta : 0;
  const fieldDelta = mode === "field" ? delta : 0;
  const { data: updated, error } = await supabase
    .from("work_time_days")
    .update({
      status,
      last_seen_at: nowIso,
      total_work_seconds: day.total_work_seconds + workDelta,
      total_interval_seconds: day.total_interval_seconds + intervalDelta,
      total_field_seconds: day.total_field_seconds + fieldDelta,
      updated_at: nowIso,
    })
    .eq("id", day.id)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await updateOpenSessionHeartbeat({ supabase, dayId: day.id, nowIso });
  if (safetyFrozenEvent) {
    await endOpenSession({ supabase, organizationId, userId, dayId: day.id, nowIso, reason: "safety_timeout" });
    await startSession({ supabase, organizationId, userId, dayId: day.id, mode: "frozen", nowIso });
    await logEvent({ supabase, organizationId, userId, dayId: day.id, eventType: "safety_timeout_frozen", nowIso });
  }
  return updated;
}

async function toggleInterval({
  supabase,
  organizationId,
  userId,
  day,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  day: WorkTimeDay;
}) {
  const now = new Date();
  const nowIso = now.toISOString();
  const targetStatus: WorkDayStatus = day.status === "paused_interval" ? "active" : "paused_interval";
  const nextSafety = addSeconds(now, SAFETY_INTERVAL_SECONDS);
  await endOpenSession({
    supabase,
    organizationId,
    userId,
    dayId: day.id,
    nowIso,
    reason: targetStatus === "paused_interval" ? "user_interval" : "user_returned",
  });
  await startSession({
    supabase,
    organizationId,
    userId,
    dayId: day.id,
    mode: targetStatus === "paused_interval" ? "interval" : "work",
    nowIso,
  });
  const { data, error } = await supabase
    .from("work_time_days")
    .update({
      status: targetStatus,
      last_seen_at: nowIso,
      last_safety_confirmed_at: nowIso,
      next_safety_due_at: nextSafety.toISOString(),
      safety_grace_until: addSeconds(nextSafety, SAFETY_GRACE_SECONDS).toISOString(),
      updated_at: nowIso,
    })
    .eq("id", day.id)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent({
    supabase,
    organizationId,
    userId,
    dayId: day.id,
    eventType: targetStatus === "paused_interval" ? "interval_started" : "interval_ended",
    nowIso,
  });
  return buildStatus(data);
}

async function toggleField({
  supabase,
  organizationId,
  userId,
  day,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  day: WorkTimeDay;
}) {
  const now = new Date();
  const nowIso = now.toISOString();
  const targetStatus: WorkDayStatus = day.status === "field_mode" ? "active" : "field_mode";
  const nextSafety = addSeconds(now, SAFETY_INTERVAL_SECONDS);
  await endOpenSession({
    supabase,
    organizationId,
    userId,
    dayId: day.id,
    nowIso,
    reason: targetStatus === "field_mode" ? "field_started" : "field_ended",
  });
  await startSession({
    supabase,
    organizationId,
    userId,
    dayId: day.id,
    mode: targetStatus === "field_mode" ? "field" : "work",
    nowIso,
  });
  const { data, error } = await supabase
    .from("work_time_days")
    .update({
      status: targetStatus,
      last_seen_at: nowIso,
      last_safety_confirmed_at: nowIso,
      next_safety_due_at: nextSafety.toISOString(),
      safety_grace_until: addSeconds(nextSafety, SAFETY_GRACE_SECONDS).toISOString(),
      updated_at: nowIso,
    })
    .eq("id", day.id)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent({
    supabase,
    organizationId,
    userId,
    dayId: day.id,
    eventType: targetStatus === "field_mode" ? "field_started" : "field_ended",
    nowIso,
  });
  return buildStatus(data);
}

async function confirmSafety({
  supabase,
  organizationId,
  userId,
  day,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  day: WorkTimeDay;
}) {
  const now = new Date();
  const nowIso = now.toISOString();
  const nextSafety = addSeconds(now, SAFETY_INTERVAL_SECONDS);
  if (day.status === "safety_frozen") {
    await endOpenSession({ supabase, organizationId, userId, dayId: day.id, nowIso, reason: "user_returned" });
    await startSession({ supabase, organizationId, userId, dayId: day.id, mode: "work", nowIso });
  }
  const { data, error } = await supabase
    .from("work_time_days")
    .update({
      status: "active",
      last_seen_at: nowIso,
      last_safety_confirmed_at: nowIso,
      next_safety_due_at: nextSafety.toISOString(),
      safety_grace_until: addSeconds(nextSafety, SAFETY_GRACE_SECONDS).toISOString(),
      updated_at: nowIso,
    })
    .eq("id", day.id)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent({ supabase, organizationId, userId, dayId: day.id, eventType: "safety_confirmed", nowIso });
  return buildStatus(data);
}

async function closeOldOpenDays({
  supabase,
  organizationId,
  userId,
  today,
  nowIso,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  today: string;
  nowIso: string;
}) {
  const { data } = await supabase
    .from("work_time_days")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .neq("work_date", today)
    .neq("status", "closed");
  let resumeField = false;
  for (const day of data ?? []) {
    const wasFieldMode = day.status === "field_mode";
    const closeAtIso = wasFieldMode ? minIso(getSaoPauloNextDayStartIso(day.work_date), nowIso) : nowIso;
    const fieldDelta = wasFieldMode ? continuousSecondsBetween(day.last_seen_at, closeAtIso) : 0;
    if (wasFieldMode) resumeField = true;
    await endOpenSession({
      supabase,
      organizationId,
      userId,
      dayId: day.id,
      nowIso: closeAtIso,
      reason: "midnight",
    });
    await supabase
      .from("work_time_days")
      .update({
        status: "closed",
        last_seen_at: wasFieldMode ? closeAtIso : day.last_seen_at,
        total_work_seconds: day.total_work_seconds + fieldDelta,
        total_field_seconds: day.total_field_seconds + fieldDelta,
        updated_at: nowIso,
      })
      .eq("id", day.id)
      .eq("organization_id", organizationId)
      .eq("user_id", userId);
    await logEvent({ supabase, organizationId, userId, dayId: day.id, eventType: "day_closed", nowIso: closeAtIso });
  }
  return { resumeField };
}

async function startSession({
  supabase,
  organizationId,
  userId,
  dayId,
  mode,
  nowIso,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  dayId: string;
  mode: WorkMode;
  nowIso: string;
}) {
  const { error } = await supabase.from("work_time_sessions").insert({
    organization_id: organizationId,
    user_id: userId,
    work_day_id: dayId,
    mode,
    started_at: nowIso,
    last_seen_at: nowIso,
  });
  if (error) throw new Error(error.message);
}

async function endOpenSession({
  supabase,
  organizationId,
  userId,
  dayId,
  nowIso,
  reason,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  dayId: string;
  nowIso: string;
  reason: WorkTimeSession["end_reason"];
}) {
  const { error } = await supabase
    .from("work_time_sessions")
    .update({ ended_at: nowIso, last_seen_at: nowIso, end_reason: reason, updated_at: nowIso })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("work_day_id", dayId)
    .is("ended_at", null);
  if (error) throw new Error(error.message);
}

async function updateOpenSessionHeartbeat({
  supabase,
  dayId,
  nowIso,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  dayId: string;
  nowIso: string;
}) {
  const { error } = await supabase
    .from("work_time_sessions")
    .update({ last_seen_at: nowIso, updated_at: nowIso })
    .eq("work_day_id", dayId)
    .is("ended_at", null);
  if (error) throw new Error(error.message);
}

async function logEvent({
  supabase,
  organizationId,
  userId,
  dayId,
  eventType,
  nowIso,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  dayId: string;
  eventType: string;
  nowIso: string;
}) {
  if (eventType === "heartbeat") return;
  const { error } = await supabase.from("work_time_events").insert({
    organization_id: organizationId,
    user_id: userId,
    work_day_id: dayId,
    event_type: eventType,
    occurred_at: nowIso,
  });
  if (error) throw new Error(error.message);
}

function buildStatus(day: WorkTimeDay) {
  const state = safetyState(day);
  return {
    day,
    workedSeconds: day.total_work_seconds,
    intervalSeconds: day.total_interval_seconds,
    fieldSeconds: day.total_field_seconds,
    shouldPromptSafety: state.shouldPrompt,
    isFrozen: day.status === "safety_frozen" || state.isFrozen,
    mode: statusToMode(day.status),
  };
}

function statusToMode(status: WorkDayStatus): WorkMode {
  if (status === "paused_interval") return "interval";
  if (status === "field_mode") return "field";
  if (status === "safety_frozen") return "frozen";
  return "work";
}

function minIso(first: string, second: string) {
  return new Date(first).getTime() <= new Date(second).getTime() ? first : second;
}
