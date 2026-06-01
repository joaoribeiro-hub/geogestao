import type { Json } from "@/types/database";

export const WORK_TIME_TIMEZONE = "America/Sao_Paulo";
export const SAFETY_INTERVAL_SECONDS = 2 * 60 * 60;
export const SAFETY_GRACE_SECONDS = 15 * 60;
export const HEARTBEAT_MAX_DELTA_SECONDS = 120;

export type WorkMode = "work" | "interval" | "field" | "frozen";
export type WorkDayStatus = "active" | "paused_interval" | "field_mode" | "safety_frozen" | "closed";

export type WorkTimeDayLike = {
  id: string;
  user_id: string;
  work_date: string;
  status: WorkDayStatus;
  first_started_at: string;
  last_seen_at: string;
  last_safety_confirmed_at: string;
  next_safety_due_at: string;
  safety_grace_until: string;
  total_work_seconds: number;
  total_interval_seconds: number;
  total_field_seconds: number;
};

export type WorkTimeEventLike = {
  event_type: string;
  occurred_at: string;
  metadata?: Json;
};

export type WorkScheduleConfig = {
  expected_minutes_by_weekday?: Json | null;
};

export type HolidayLike = {
  date: string;
  name: string;
  affects_expected_hours: boolean;
};

export function getSaoPauloDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORK_TIME_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

export function secondsBetween(fromIso: string, toIso: string, maxSeconds = HEARTBEAT_MAX_DELTA_SECONDS) {
  const seconds = Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  return Math.max(0, Math.min(seconds, maxSeconds));
}

export function continuousSecondsBetween(fromIso: string, toIso: string) {
  const seconds = Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  return Math.max(0, seconds);
}

export function getSaoPauloDayStartIso(dateKey: string) {
  return new Date(`${dateKey}T00:00:00-03:00`).toISOString();
}

export function getSaoPauloNextDayStartIso(dateKey: string) {
  return new Date(new Date(`${dateKey}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000)
    .toISOString();
}

export function getDefaultExpectedMinutesByWeekday() {
  return { 0: 0, 1: 480, 2: 480, 3: 480, 4: 480, 5: 480, 6: 0 } satisfies Record<number, number>;
}

export function normalizeExpectedMinutesByWeekday(value: Json | null | undefined) {
  const defaults = getDefaultExpectedMinutesByWeekday();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const record = value as Record<string, Json | undefined>;
  return {
    0: toMinutes(record["0"], defaults[0]),
    1: toMinutes(record["1"], defaults[1]),
    2: toMinutes(record["2"], defaults[2]),
    3: toMinutes(record["3"], defaults[3]),
    4: toMinutes(record["4"], defaults[4]),
    5: toMinutes(record["5"], defaults[5]),
    6: toMinutes(record["6"], defaults[6]),
  };
}

export function buildExpectedMinutesJson(values: Record<number, number>) {
  return {
    "0": clampMinutes(values[0] ?? 0),
    "1": clampMinutes(values[1] ?? 0),
    "2": clampMinutes(values[2] ?? 0),
    "3": clampMinutes(values[3] ?? 0),
    "4": clampMinutes(values[4] ?? 0),
    "5": clampMinutes(values[5] ?? 0),
    "6": clampMinutes(values[6] ?? 0),
  };
}

export function expectedSecondsForDate({
  date,
  schedule,
  holidays = [],
}: {
  date: string;
  schedule?: WorkScheduleConfig | null;
  holidays?: HolidayLike[];
}) {
  const holiday = holidays.find((item) => matchesHolidayDate(item.date, date) && item.affects_expected_hours);
  if (holiday) return 0;
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const expected = normalizeExpectedMinutesByWeekday(schedule?.expected_minutes_by_weekday);
  return expected[weekday as keyof typeof expected] * 60;
}

export function calculateDailyWorkSummary({
  day,
  events = [],
  schedule,
  holidays = [],
  date,
}: {
  day?: WorkTimeDayLike | null;
  events?: WorkTimeEventLike[];
  schedule?: WorkScheduleConfig | null;
  holidays?: HolidayLike[];
  date: string;
}) {
  const workedSeconds = day?.total_work_seconds ?? 0;
  const intervalSeconds = day?.total_interval_seconds ?? 0;
  const fieldSeconds = day?.total_field_seconds ?? 0;
  const expectedSeconds = expectedSecondsForDate({ date, schedule, holidays });
  const isHoliday = holidays.some((holiday) => matchesHolidayDate(holiday.date, date));
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  return {
    date,
    worked_seconds: workedSeconds,
    interval_seconds: intervalSeconds,
    field_seconds: fieldSeconds,
    expected_seconds: expectedSeconds,
    missing_seconds: Math.max(expectedSeconds - workedSeconds, 0),
    overtime_seconds: expectedSeconds > 0 ? Math.max(workedSeconds - expectedSeconds, 0) : workedSeconds,
    is_holiday: isHoliday,
    is_weekend: isWeekend,
    is_working_day: expectedSeconds > 0,
    status: day?.status ?? "closed",
    safety_confirmations: events.filter((event) => event.event_type === "safety_confirmed"),
    intervals: events.filter((event) => event.event_type === "interval_started" || event.event_type === "interval_ended"),
    field_periods: events.filter((event) => event.event_type === "field_started" || event.event_type === "field_ended"),
    events,
  };
}

export function calculatePeriodWorkSummary(dailySummaries: Array<ReturnType<typeof calculateDailyWorkSummary>>) {
  return dailySummaries.reduce(
    (acc, day) => ({
      worked_seconds: acc.worked_seconds + day.worked_seconds,
      interval_seconds: acc.interval_seconds + day.interval_seconds,
      field_seconds: acc.field_seconds + day.field_seconds,
      expected_seconds: acc.expected_seconds + day.expected_seconds,
      missing_seconds: acc.missing_seconds + day.missing_seconds,
      overtime_seconds: acc.overtime_seconds + day.overtime_seconds,
      working_days: acc.working_days + (day.is_working_day ? 1 : 0),
      holidays: acc.holidays + (day.is_holiday ? 1 : 0),
      presence_days: acc.presence_days + (day.worked_seconds > 0 ? 1 : 0),
    }),
    {
      worked_seconds: 0,
      interval_seconds: 0,
      field_seconds: 0,
      expected_seconds: 0,
      missing_seconds: 0,
      overtime_seconds: 0,
      working_days: 0,
      holidays: 0,
      presence_days: 0,
    },
  );
}

export function safetyState(day: Pick<WorkTimeDayLike, "status" | "next_safety_due_at" | "safety_grace_until">, now = new Date()) {
  if (day.status === "paused_interval" || day.status === "field_mode" || day.status === "closed") {
    return { shouldPrompt: false, isFrozen: false };
  }
  if (day.status === "safety_frozen") {
    return { shouldPrompt: true, isFrozen: true };
  }
  const time = now.getTime();
  return {
    shouldPrompt: time >= new Date(day.next_safety_due_at).getTime(),
    isFrozen: time > new Date(day.safety_grace_until).getTime(),
  };
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}m`;
}

export function dateRangeInclusive(from: string, to: string) {
  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00-03:00`);
  const end = new Date(`${to}T12:00:00-03:00`);
  for (let count = 0; cursor <= end && count < 370; count += 1) {
    dates.push(getSaoPauloDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function toMinutes(value: Json | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return clampMinutes(value);
  if (typeof value === "string" && value.trim()) return clampMinutes(Number(value));
  return fallback;
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1440, Math.round(value)));
}

function matchesHolidayDate(holidayDate: string, date: string) {
  return holidayDate === date || holidayDate.slice(5) === date.slice(5);
}
