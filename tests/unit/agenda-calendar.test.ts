import { describe, expect, it } from "vitest";
import {
  adjacentMonths,
  buildMonthGrid,
  formatMonthTitle,
  monthBounds,
  parseMonthParam,
} from "@/lib/agenda/calendar";

describe("agenda calendar helpers", () => {
  it("abre no mes informado pela URL", () => {
    const month = parseMonthParam("2026-05");

    expect(month.year).toBe(2026);
    expect(month.monthIndex).toBe(4);
    expect(month.month).toBe("2026-05");
  });

  it("calcula mes anterior, atual e proximo", () => {
    const nav = adjacentMonths(2026, 4);

    expect(nav.previous).toBe("2026-04");
    expect(nav.next).toBe("2026-06");
    expect(nav.current).toMatch(/^\d{4}-\d{2}$/);
  });

  it("gera grade mensal de domingo a sabado", () => {
    const days = buildMonthGrid(2026, 4);

    expect(days).toHaveLength(42);
    expect(days.some((day) => day.date === "2026-05-01" && day.inMonth)).toBe(true);
    expect(days.some((day) => day.date === "2026-05-31" && day.inMonth)).toBe(true);
  });

  it("calcula limites do mes", () => {
    expect(monthBounds(2026, 4)).toEqual({ from: "2026-05-01", to: "2026-05-31" });
  });

  it("formata titulo do mes", () => {
    expect(formatMonthTitle(2026, 4)).toContain("2026");
  });
});
