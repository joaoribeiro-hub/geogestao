export type PeriodPreset =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_3_months"
  | "last_12_months"
  | "this_month"
  | "month_to_date"
  | "quarter_to_date"
  | "year_to_date"
  | "all"
  | "custom";

export type PeriodRange = {
  period: PeriodPreset;
  from: string | null;
  to: string | null;
};

export const periodOptions: Array<{ id: PeriodPreset; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "last_7_days", label: "Ultimos 7 dias" },
  { id: "last_30_days", label: "Ultimos 30 dias" },
  { id: "last_3_months", label: "Ultimos 3 meses" },
  { id: "last_12_months", label: "Ultimos 12 meses" },
  { id: "this_month", label: "Este mes" },
  { id: "month_to_date", label: "Mes ate a data" },
  { id: "quarter_to_date", label: "Trimestre ate a data" },
  { id: "year_to_date", label: "Ano ate a data" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Personalizado" },
];

const validPeriods = new Set<PeriodPreset>(periodOptions.map((option) => option.id));

export function resolvePeriodRange(
  params: Record<string, string | string[] | undefined> | undefined,
  now = new Date(),
  defaultPeriod: PeriodPreset = "this_month",
): PeriodRange {
  const periodParam = getParam(params, "period");
  const period = validPeriods.has(periodParam as PeriodPreset)
    ? (periodParam as PeriodPreset)
    : defaultPeriod;

  if (period === "all") {
    return { period, from: null, to: null };
  }

  if (period === "custom") {
    return {
      period,
      from: normalizeDate(getParam(params, "from")),
      to: normalizeDate(getParam(params, "to")),
    };
  }

  const today = toDateOnly(now);
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const startOfQuarter = new Date(
    Date.UTC(today.getUTCFullYear(), Math.floor(today.getUTCMonth() / 3) * 3, 1),
  );
  const startOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  switch (period) {
    case "today":
      return { period, from: formatDateOnly(today), to: formatDateOnly(today) };
    case "last_7_days":
      return { period, from: formatDateOnly(addDays(today, -6)), to: formatDateOnly(today) };
    case "last_30_days":
      return { period, from: formatDateOnly(addDays(today, -29)), to: formatDateOnly(today) };
    case "last_3_months":
      return { period, from: formatDateOnly(addMonths(today, -3)), to: formatDateOnly(today) };
    case "last_12_months":
      return { period, from: formatDateOnly(addMonths(today, -12)), to: formatDateOnly(today) };
    case "month_to_date":
      return { period, from: formatDateOnly(startOfMonth), to: formatDateOnly(today) };
    case "quarter_to_date":
      return { period, from: formatDateOnly(startOfQuarter), to: formatDateOnly(today) };
    case "year_to_date":
      return { period, from: formatDateOnly(startOfYear), to: formatDateOnly(today) };
    case "this_month":
    default:
      return { period, from: formatDateOnly(startOfMonth), to: formatDateOnly(endOfMonth) };
  }
}

export function filterByPeriod<T>(
  rows: T[],
  range: PeriodRange,
  getDate: (row: T) => string | null | undefined,
) {
  if (range.period === "all") return rows;

  return rows.filter((row) => isDateInPeriod(getDate(row), range));
}

export function isDateInPeriod(value: string | null | undefined, range: PeriodRange) {
  if (range.period === "all") return true;
  const date = normalizeDate(value);
  if (!date) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function periodLabel(range: PeriodRange) {
  const option = periodOptions.find((item) => item.id === range.period);
  if (range.period === "all") return option?.label ?? "Tudo";
  if (range.from && range.to) return `${option?.label ?? "Periodo"}: ${range.from} a ${range.to}`;
  if (range.from) return `${option?.label ?? "Periodo"}: desde ${range.from}`;
  if (range.to) return `${option?.label ?? "Periodo"}: ate ${range.to}`;
  return option?.label ?? "Periodo";
}

function getParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match?.[0] ?? null;
}

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function addMonths(value: Date, months: number) {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
