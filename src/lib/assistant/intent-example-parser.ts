import { createHash } from "node:crypto";
import { normalizeAssistantText } from "@/lib/assistant/intent-detector";

export type ParsedIntentExample = {
  rawText: string;
  normalizedText: string;
  intentName: string;
  synonym?: string | null;
  paramsSample: Record<string, unknown>;
  entitiesSample: Record<string, unknown>;
  requiresConfirmation?: boolean | null;
  confidence?: number | null;
  sourceLine: number;
};

export type IntentDatasetSummary = {
  totalLines: number;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  unknownCount: number;
  intents: Record<string, number>;
  examples: ParsedIntentExample[];
};

export const defaultUnknownIntent = "pendente_classificacao";

export const intentActionMap: Record<string, string> = {
  "dashboard.feedback": "unknown",
  "dashboard.metric.clients_total": "unknown",
  "dashboard.metric.proposals_sent": "unknown",
  "dashboard.metric.proposals_approved": "unknown",
  "dashboard.metric.proposals_waiting": "unknown",
  "dashboard.metric.proposals_lost": "unknown",
  "dashboard.metric.contracts": "unknown",
  "dashboard.metric.revenues_expenses": "unknown",
  "dashboard.next_due": "unknown",
  "dashboard.overdue_projects": "listOverdueServices",
  "period.filter": "unknown",
  "service.create": "unknown",
  "service.create.ask_missing_fields": "unknown",
  "service.summary": "unknown",
  "service.list.today": "listTodayServices",
  "service.list.overdue": "listOverdueServices",
  "service.list.by_client": "listClientServices",
  "service.list.by_type": "unknown",
  "service.list.by_stage": "unknown",
  "task.list.pending": "listPendingTasks",
  "client.summary": "summarizeClient",
  "client.interaction.create": "createClientInteraction",
  "client.task.create": "createClientTask",
  list_today_services: "listTodayServices",
  list_month_services: "listMonthServices",
  list_overdue_services: "listOverdueServices",
  list_pending_tasks: "listPendingTasks",
  list_inactive_clients: "listInactiveClients",
  summarize_client: "summarizeClient",
  create_client_task: "createClientTask",
  create_member_task: "assignChecklistItem",
  create_client_interaction: "createClientInteraction",
  list_client_services: "listClientServices",
  list_client_commercial_records: "listClientCommercialRecords",
  unknown: "unknown",
  pendente_classificacao: "unknown",
};

export function parseIntentDataset(content: string): IntentDatasetSummary {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  let headers: string[] | null = null;
  const seen = new Set<string>();
  const examples: ParsedIntentExample[] = [];
  let skippedCount = 0;
  let duplicateCount = 0;

  lines.forEach((line, index) => {
    const sourceLine = index + 1;
    const trimmed = line.trim();
    if (!trimmed) {
      skippedCount += 1;
      return;
    }

    if (!headers && looksLikeHeader(trimmed)) {
      headers = splitDelimited(trimmed).map(normalizeHeader);
      skippedCount += 1;
      return;
    }

    const parsed = parseIntentExampleLine(line, sourceLine, headers);
    if (!parsed) {
      skippedCount += 1;
      return;
    }

    const key = `${parsed.intentName}::${parsed.normalizedText}`;
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    examples.push(parsed);
  });

  const intents = examples.reduce<Record<string, number>>((acc, item) => {
    acc[item.intentName] = (acc[item.intentName] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalLines: lines.length,
    importedCount: examples.length,
    skippedCount,
    duplicateCount,
    unknownCount: examples.filter((item) => item.intentName === defaultUnknownIntent || item.intentName === "unknown").length,
    intents,
    examples,
  };
}

export function parseIntentExampleLine(
  line: string,
  sourceLine = 1,
  headers: string[] | null = null,
): ParsedIntentExample | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const json = parseJsonLine(trimmed, sourceLine);
  if (json) return json;

  const arrow = parseArrowLine(trimmed, sourceLine);
  if (arrow) return arrow;

  const keyValue = parseKeyValueLine(trimmed, sourceLine);
  if (keyValue) return keyValue;

  const columns = splitDelimited(trimmed);
  if (columns.length >= 2) {
    const row = mapColumns(columns, headers);
    return buildExample({
      rawText: row.frase ?? row.texto ?? row.text ?? columns[0],
      synonym: row.sinonimo ?? row.synonym ?? null,
      intentName: row.funcao ?? row.function ?? row.intent ?? row.intencao ?? columns[2] ?? columns[1],
      sourceLine,
    });
  }

  return buildExample({
    rawText: trimmed,
    intentName: defaultUnknownIntent,
    sourceLine,
  });
}

export function normalizeExampleText(value: string) {
  return normalizeAssistantText(value);
}

export function sourceHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function actionNameForIntent(intentName: string) {
  return intentActionMap[intentName] ?? "unknown";
}

export function categoryForIntent(intentName: string) {
  return intentName.includes(".") ? intentName.split(".")[0] : intentName.split("_")[0] ?? "assistant";
}

function parseJsonLine(line: string, sourceLine: number) {
  if (!line.startsWith("{")) return null;
  try {
    const data = JSON.parse(line) as Record<string, unknown>;
    const rawText = stringValue(data.frase) ?? stringValue(data.texto) ?? stringValue(data.text) ?? stringValue(data.raw_text);
    if (!rawText) return null;
    return buildExample({
      rawText,
      synonym: stringValue(data.sinonimo) ?? stringValue(data.synonym),
      intentName: stringValue(data.intent) ?? stringValue(data.intencao) ?? stringValue(data.funcao) ?? defaultUnknownIntent,
      paramsSample: objectValue(data.params) ?? objectValue(data.params_sample) ?? {},
      entitiesSample: objectValue(data.entities) ?? objectValue(data.entities_sample) ?? {},
      requiresConfirmation: booleanValue(data.requiresConfirmation) ?? booleanValue(data.requires_confirmation),
      confidence: numberValue(data.confidence),
      sourceLine,
    });
  } catch {
    return null;
  }
}

function parseArrowLine(line: string, sourceLine: number) {
  const match = /^["']?(.+?)["']?\s*(?:->|=>)\s*["']?([a-zA-Z0-9_.:-]+)["']?$/.exec(line);
  if (!match) return null;
  return buildExample({
    rawText: match[1],
    intentName: match[2],
    sourceLine,
  });
}

function parseKeyValueLine(line: string, sourceLine: number) {
  if (!/(texto|frase|intent|funcao|função)\s*[:=]/i.test(line)) return null;
  const parts = line.split("|").map((part) => part.trim());
  const row: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...rest] = part.split(/[:=]/);
    if (!key || !rest.length) continue;
    row[normalizeHeader(key)] = rest.join(":").trim();
  }
  const rawText = row.frase ?? row.texto ?? row.text;
  if (!rawText) return null;
  return buildExample({
    rawText,
    synonym: row.sinonimo ?? null,
    intentName: row.intent ?? row.intencao ?? row.funcao ?? defaultUnknownIntent,
    sourceLine,
  });
}

function buildExample({
  rawText,
  intentName,
  sourceLine,
  synonym = null,
  paramsSample = {},
  entitiesSample = {},
  requiresConfirmation = null,
  confidence = null,
}: {
  rawText: string;
  intentName: string;
  sourceLine: number;
  synonym?: string | null;
  paramsSample?: Record<string, unknown>;
  entitiesSample?: Record<string, unknown>;
  requiresConfirmation?: boolean | null;
  confidence?: number | null;
}): ParsedIntentExample | null {
  const cleanedText = cleanCell(rawText);
  if (!cleanedText) return null;
  const cleanedIntent = cleanCell(intentName) || defaultUnknownIntent;
  return {
    rawText: cleanedText,
    normalizedText: normalizeExampleText(cleanedText),
    intentName: cleanedIntent,
    synonym: synonym ? cleanCell(synonym) : null,
    paramsSample,
    entitiesSample,
    requiresConfirmation,
    confidence,
    sourceLine,
  };
}

function looksLikeHeader(line: string) {
  const headers = splitDelimited(line).map(normalizeHeader);
  return headers.includes("frase") && (headers.includes("funcao") || headers.includes("intent"));
}

function splitDelimited(line: string) {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return splitCsvLike(line, delimiter).map(cleanCell);
}

function splitCsvLike(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}

function mapColumns(columns: string[], headers: string[] | null) {
  if (!headers) return {};
  return columns.reduce<Record<string, string>>((acc, value, index) => {
    const header = headers[index];
    if (header) acc[header] = value;
    return acc;
  }, {});
}

function normalizeHeader(value: string) {
  return normalizeAssistantText(value).replace(/\s+/g, "_");
}

function cleanCell(value: string) {
  return value.trim().replace(/^["']|["']$/g, "").trim();
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
