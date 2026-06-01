import { describe, expect, it } from "vitest";
import {
  calculateDailyWorkSummary,
  calculatePeriodWorkSummary,
  continuousSecondsBetween,
  expectedSecondsForDate,
  formatDuration,
  safetyState,
} from "@/lib/services/work-time";

const baseDay = {
  id: "day-1",
  user_id: "user-1",
  work_date: "2026-05-27",
  status: "active" as const,
  first_started_at: "2026-05-27T11:00:00.000Z",
  last_seen_at: "2026-05-27T17:00:00.000Z",
  last_safety_confirmed_at: "2026-05-27T15:00:00.000Z",
  next_safety_due_at: "2026-05-27T17:00:00.000Z",
  safety_grace_until: "2026-05-27T17:15:00.000Z",
  total_work_seconds: 6 * 3600,
  total_interval_seconds: 30 * 60,
  total_field_seconds: 2 * 3600,
};

describe("work time calculations", () => {
  it("calculates missing hours for an 8h working day", () => {
    const summary = calculateDailyWorkSummary({
      day: baseDay,
      date: "2026-05-27",
      schedule: { expected_minutes_by_weekday: { "3": 480 } },
    });

    expect(summary.expected_seconds).toBe(8 * 3600);
    expect(summary.missing_seconds).toBe(2 * 3600);
    expect(summary.overtime_seconds).toBe(0);
    expect(summary.interval_seconds).toBe(30 * 60);
  });

  it("turns work on holiday into overtime", () => {
    const summary = calculateDailyWorkSummary({
      day: { ...baseDay, total_work_seconds: 3 * 3600 },
      date: "2026-05-01",
      holidays: [{ date: "2026-05-01", name: "Dia do Trabalhador", affects_expected_hours: true }],
    });

    expect(summary.expected_seconds).toBe(0);
    expect(summary.overtime_seconds).toBe(3 * 3600);
    expect(summary.is_holiday).toBe(true);
  });

  it("supports 6x1 Saturday schedule", () => {
    expect(
      expectedSecondsForDate({
        date: "2026-05-30",
        schedule: { expected_minutes_by_weekday: { "6": 240 } },
      }),
    ).toBe(4 * 3600);
  });

  it("sums missing and overtime by day for a period", () => {
    const first = calculateDailyWorkSummary({
      day: { ...baseDay, total_work_seconds: 9 * 3600 },
      date: "2026-05-27",
      schedule: { expected_minutes_by_weekday: { "3": 480 } },
    });
    const second = calculateDailyWorkSummary({
      day: { ...baseDay, total_work_seconds: 6 * 3600 },
      date: "2026-05-28",
      schedule: { expected_minutes_by_weekday: { "4": 480 } },
    });

    const total = calculatePeriodWorkSummary([first, second]);
    expect(total.overtime_seconds).toBe(1 * 3600);
    expect(total.missing_seconds).toBe(2 * 3600);
  });

  it("prompts and freezes safety after due/grace windows", () => {
    const prompt = safetyState(baseDay, new Date("2026-05-27T17:05:00.000Z"));
    const frozen = safetyState(baseDay, new Date("2026-05-27T17:16:00.000Z"));

    expect(prompt.shouldPrompt).toBe(true);
    expect(prompt.isFrozen).toBe(false);
    expect(frozen.shouldPrompt).toBe(true);
    expect(frozen.isFrozen).toBe(true);
  });

  it("does not prompt safety while field mode is active", () => {
    const state = safetyState(
      { ...baseDay, status: "field_mode" },
      new Date("2026-05-27T20:30:00.000Z"),
    );

    expect(state.shouldPrompt).toBe(false);
    expect(state.isFrozen).toBe(false);
  });

  it("allows field mode to accrue beyond the heartbeat cap", () => {
    expect(
      continuousSecondsBetween("2026-05-27T11:00:00.000Z", "2026-05-27T14:00:00.000Z"),
    ).toBe(3 * 3600);
  });

  it("formats durations for the topbar", () => {
    expect(formatDuration(3 * 3600 + 24 * 60)).toBe("03h24m");
  });
});
