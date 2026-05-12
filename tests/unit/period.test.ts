import { describe, expect, it } from "vitest";
import { filterByPeriod, resolvePeriodRange } from "@/lib/period";

describe("filtro reutilizavel por periodo", () => {
  const now = new Date("2026-05-09T12:00:00.000Z");

  it("resolve este mes como padrao", () => {
    expect(resolvePeriodRange({}, now)).toEqual({
      period: "this_month",
      from: "2026-05-01",
      to: "2026-05-31",
    });
  });

  it("resolve intervalo personalizado por query params", () => {
    expect(resolvePeriodRange({ period: "custom", from: "2026-04-01", to: "2026-04-30" }, now)).toEqual({
      period: "custom",
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });

  it("filtra linhas usando o campo de data informado", () => {
    const rows = [
      { id: "antes", date: "2026-04-30" },
      { id: "dentro", date: "2026-05-05" },
      { id: "sem-data", date: null },
    ];
    const range = resolvePeriodRange({ period: "this_month" }, now);

    expect(filterByPeriod(rows, range, (row) => row.date).map((row) => row.id)).toEqual([
      "dentro",
      "sem-data",
    ]);
  });
});
