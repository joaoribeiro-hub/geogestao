import { normalizeAssistantText } from "@/lib/assistant/intent-detector";

export function normalizeAssistantDate(value: unknown, baseDate = new Date()) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const normalized = normalizeAssistantText(raw);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return isValidIsoDate(raw) ? raw : null;

  const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (brDate) {
    const [, day, month, year] = brDate;
    const iso = `${year}-${month}-${day}`;
    return isValidIsoDate(iso) ? iso : null;
  }

  if (normalized === "hoje" || normalized.includes("dia de hoje")) {
    return addDays(baseDate, 0);
  }

  if (normalized === "amanha" || normalized.includes("para amanha") || normalized.includes("pra amanha")) {
    return addDays(baseDate, 1);
  }

  if (normalized.includes("depois de amanha")) {
    return addDays(baseDate, 2);
  }

  const monthMatch =
    /\b(?:daqui\s+)?(\d+|um|uma|dois|duas|tres)\s+m[eê]s(?:es)?\b/.exec(normalized) ??
    /\bprazo\s+de\s+(\d+|um|uma|dois|duas|tres)\s+m[eê]s(?:es)?\b/.exec(normalized);
  if (monthMatch) {
    return addMonths(baseDate, wordNumberToNumber(monthMatch[1]));
  }

  const daquiMatch = /\bdaqui\s+(\d+|um|uma|dois|duas|tres)\b/.exec(normalized);
  if (daquiMatch) {
    return addDays(baseDate, wordNumberToNumber(daquiMatch[1]));
  }

  if (normalized === "ontem") {
    return addDays(baseDate, -1);
  }

  return null;
}

function wordNumberToNumber(value: string) {
  const normalized = normalizeAssistantText(value);
  if (normalized === "um" || normalized === "uma") return 1;
  if (normalized === "dois" || normalized === "duas") return 2;
  if (normalized === "tres") return 3;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(baseDate: Date, amount: number) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function addMonths(baseDate: Date, amount: number) {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + amount);
  return date.toISOString().slice(0, 10);
}

function isValidIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
