import JSZip from "jszip";
import type { Json, Priority } from "@/types/database";

export type TrelloImportRow = Record<string, string>;

export type ServiceImportPreviewRow = {
  externalId: string | null;
  title: string;
  description: string | null;
  listName: string | null;
  sourceLabels: string | null;
  columnId: string;
  columnName: string;
  priority: Priority;
  dueDate: string | null;
  serviceDate: string | null;
  externalUrl: string | null;
  labels: string | null;
  raw: TrelloImportRow;
  duplicate?: boolean;
};

export type ServiceImportColumn = {
  id: string;
  name: string;
  slug: string;
};

export async function parseTrelloImportFile(filename: string, buffer: Buffer) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsv(buffer.toString("utf8"));
  if (lower.endsWith(".xlsx")) return parseXlsx(buffer);
  throw new Error("Envie um arquivo .xlsx ou .csv exportado do Trello.");
}

export function mapTrelloRowsToServices(rows: TrelloImportRow[], columns: ServiceImportColumn[]) {
  return rows
    .filter((row) => getValue(row, "Card Name"))
    .map<ServiceImportPreviewRow>((row) => {
      const sourceLabels = getAnyValue(row, ["Labels", "Card"]);
      const listName = getAnyValue(row, ["List Name", "Lista"]);
      const column = resolveColumn(listName || sourceLabels, columns);
      return {
        externalId: getValue(row, "Card ID") || null,
        title: getValue(row, "Card Name") || "Servico importado",
        description: buildDescription(row),
        listName: listName || sourceLabels || null,
        sourceLabels: sourceLabels || null,
        columnId: column.id,
        columnName: column.name,
        priority: resolvePriority(sourceLabels),
        dueDate: toDateOnly(getValue(row, "Due Date")),
        serviceDate: toDateOnly(getValue(row, "Start Date")) ?? toDateOnly(getValue(row, "Last Activity Date")),
        externalUrl: getValue(row, "Card URL") || null,
        labels: sourceLabels || null,
        raw: row,
      };
    });
}

export function normalizeImportText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function rawImportData(row: TrelloImportRow): Json {
  return row as Json;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }
  return rowsToObjects(rows);
}

async function parseXlsx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const workbook = await zip.file("xl/workbook.xml")?.async("text");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  const firstSheetRel = workbook?.match(/<sheet[^>]+r:id="([^"]+)"/)?.[1] ?? "rId1";
  const sheetTarget = rels?.match(new RegExp(`<Relationship[^>]+Id="${firstSheetRel}"[^>]+Target="([^"]+)"`))?.[1] ?? "worksheets/sheet1.xml";
  const sheetPath = sheetTarget.startsWith("xl/") ? sheetTarget : `xl/${sheetTarget}`;
  const sheet = await zip.file(sheetPath)?.async("text");
  if (!sheet) throw new Error("Nao foi possivel ler a primeira aba da planilha.");
  const sharedStrings = await parseSharedStrings(zip);
  const rows: string[][] = [];
  const rowMatches = sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g);
  for (const rowMatch of rowMatches) {
    const values: string[] = [];
    const cells = rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g);
    for (const cell of cells) {
      const attrs = cell[1];
      const body = cell[2];
      const ref = attrs.match(/\sr="([A-Z]+)\d+"/)?.[1];
      const index = ref ? columnIndex(ref) : values.length;
      values[index] = readCellValue(attrs, body, sharedStrings);
    }
    rows.push(values.map((value) => value ?? ""));
  }
  return rowsToObjects(rows);
}

async function parseSharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join(""),
  );
}

function readCellValue(attrs: string, body: string, sharedStrings: string[]) {
  const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (attrs.includes('t="s"')) return sharedStrings[Number(value)] ?? "";
  if (attrs.includes('t="inlineStr"')) {
    return decodeXml(Array.from(body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => match[1]).join(""));
  }
  return decodeXml(value);
}

function rowsToObjects(rows: string[][]) {
  const [headers, ...body] = rows.filter((row) => row.some((value) => value?.trim()));
  if (!headers) return [];
  return body.map((row) =>
    headers.reduce<TrelloImportRow>((acc, header, index) => {
      acc[header.trim()] = (row[index] ?? "").trim();
      return acc;
    }, {}),
  );
}

function resolveColumn(listName: string, columns: ServiceImportColumn[]) {
  const normalized = normalizeImportText(stripLabelColors(listName));
  const direct = columns.find((column) => {
    const value = normalizeImportText(`${column.name} ${column.slug}`);
    return normalized && (value.includes(normalized) || normalized.includes(value));
  });
  if (direct) return direct;
  const mapped = [
    { pattern: /carta de confrontacao|confrontante/, target: /pendencia.*confrontante|confrontante/ },
    { pattern: /protocolo cartorio|protocolado cartorio|cartorio/, target: /protocolado.*cartorio|cartorio/ },
    { pattern: /protocolo incra|protocolado incra|incra/, target: /protocolado.*incra|incra/ },
    { pattern: /concluido|concluso|finalizado/, target: /concluido|concluso|finalizado/ },
    { pattern: /em andamento|andamento/, target: /geo.*andamento|em andamento|execucao/ },
    { pattern: /servico prioridades|prioridade/, target: /prioridade|urgente|andamento/ },
    { pattern: /geo antigos|a concluir/, target: /andamento|execucao|prioridade/ },
  ].find((item) => item.pattern.test(normalized));
  if (mapped) {
    const found = columns.find((column) => mapped.target.test(normalizeImportText(`${column.name} ${column.slug}`)));
    if (found) return found;
  }
  return (
    columns.find((column) => /aguard|document|pendente|prioridade/.test(normalizeImportText(`${column.name} ${column.slug}`))) ??
    columns[0]
  );
}

function resolvePriority(labels: string): Priority {
  const normalized = normalizeImportText(stripLabelColors(labels));
  if (/urgente|emergencia/.test(normalized)) return "urgent";
  if (/prioridade|alta/.test(normalized)) return "high";
  return "medium";
}

function buildDescription(row: TrelloImportRow) {
  const sourceLabels = getAnyValue(row, ["Labels", "Card"]);
  const parts = [
    getAnyValue(row, ["Card Description", "Descricao", "Descrição"]),
    sourceLabels ? `Etiquetas/status de origem: ${sourceLabels}` : null,
    getValue(row, "Members") ? `Membros Trello: ${getValue(row, "Members")}` : null,
    getValue(row, "Card URL") ? `Origem Trello: ${getValue(row, "Card URL")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

function getValue(row: TrelloImportRow, key: string) {
  return row[key]?.trim() ?? "";
}

function getAnyValue(row: TrelloImportRow, keys: string[]) {
  for (const key of keys) {
    const exact = row[key]?.trim();
    if (exact) return exact;
    const normalizedKey = normalizeImportText(key);
    const foundKey = Object.keys(row).find((candidate) => normalizeImportText(candidate) === normalizedKey);
    const found = foundKey ? row[foundKey]?.trim() : "";
    if (found) return found;
  }
  return "";
}

function stripLabelColors(value: string | null | undefined) {
  return (value ?? "").replace(/\([^)]*\)/g, " ");
}

function toDateOnly(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10) || null;
  return parsed.toISOString().slice(0, 10);
}

function columnIndex(value: string) {
  return value.split("").reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
