import JSZip from "jszip";

export async function readUploadedText(file: File) {
  const buffer = await file.arrayBuffer();
  if (isXlsx(file)) return readXlsxAsDelimitedText(buffer);
  if (file.name.toLowerCase().endsWith(".xls")) {
    throw new Error("Planilha .xls ainda nao e suportada. Salve como .xlsx, .csv ou TXT e tente novamente.");
  }

  const bytes = new Uint8Array(buffer);
  const candidates = ["utf-8", "windows-1252", "iso-8859-1"];

  for (const encoding of candidates) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: encoding === "utf-8" });
      const text = decoder.decode(bytes);
      if (text.trim()) return { text, encoding };
    } catch {
      // Try next encoding.
    }
  }

  return { text: new TextDecoder().decode(bytes), encoding: "utf-8" };
}

async function readXlsxAsDelimitedText(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = await getFirstWorksheetPath(zip);
  const sheet = await zip.file(sheetPath)?.async("text");
  if (!sheet) throw new Error("Nao foi possivel ler a primeira aba da planilha XLSX.");

  const sharedStrings = await parseSharedStrings(zip);
  const dateStyleIndexes = await parseDateStyleIndexes(zip);
  const rows: string[][] = [];
  const rowMatches = sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g);

  for (const rowMatch of rowMatches) {
    const values: string[] = [];
    const cells = rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g);
    for (const cell of cells) {
      const attrs = cell[1];
      const body = cell[2] ?? "";
      const ref = attrs.match(/\sr="([A-Z]+)\d+"/)?.[1];
      const index = ref ? columnIndex(ref) : values.length;
      values[index] = readXlsxCellValue(attrs, body, sharedStrings, dateStyleIndexes);
    }
    if (values.some((value) => value?.trim())) rows.push(values.map((value) => value ?? ""));
  }

  if (!rows.length) throw new Error("A planilha XLSX nao possui linhas legiveis.");
  return { text: rows.map((row) => row.join("\t")).join("\n"), encoding: "xlsx" };
}

async function getFirstWorksheetPath(zip: JSZip) {
  const workbook = await zip.file("xl/workbook.xml")?.async("text");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  const firstSheetRel = workbook?.match(/<sheet[^>]+r:id="([^"]+)"/)?.[1] ?? "rId1";
  const sheetTarget = rels?.match(new RegExp(`<Relationship[^>]+Id="${firstSheetRel}"[^>]+Target="([^"]+)"`))?.[1] ?? "worksheets/sheet1.xml";
  if (sheetTarget.startsWith("/")) return sheetTarget.replace(/^\//, "");
  return sheetTarget.startsWith("xl/") ? sheetTarget : `xl/${sheetTarget}`;
}

async function parseSharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join(""),
  );
}

async function parseDateStyleIndexes(zip: JSZip) {
  const xml = await zip.file("xl/styles.xml")?.async("text");
  if (!xml) return new Set<number>();

  const dateNumFmtIds = new Set([
    14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57,
  ]);
  for (const match of xml.matchAll(/<numFmt[^>]+numFmtId="(\d+)"[^>]+formatCode="([^"]+)"/g)) {
    if (/[dmyhs]/i.test(decodeXml(match[2]))) dateNumFmtIds.add(Number(match[1]));
  }

  const cellXfs = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const dateStyles = new Set<number>();
  Array.from(cellXfs.matchAll(/<xf[^>]*numFmtId="(\d+)"[^>]*\/?>/g)).forEach((match, index) => {
    if (dateNumFmtIds.has(Number(match[1]))) dateStyles.add(index);
  });
  return dateStyles;
}

function readXlsxCellValue(attrs: string, body: string, sharedStrings: string[], dateStyleIndexes: Set<number>) {
  const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (attrs.includes('t="s"')) return sharedStrings[Number(value)] ?? "";
  if (attrs.includes('t="inlineStr"')) {
    return decodeXml(Array.from(body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => match[1]).join(""));
  }

  const styleIndex = Number(attrs.match(/\ss="(\d+)"/)?.[1] ?? Number.NaN);
  const numericValue = Number(value);
  if (Number.isFinite(styleIndex) && dateStyleIndexes.has(styleIndex) && Number.isFinite(numericValue)) {
    return excelSerialToDateTime(numericValue);
  }
  return decodeXml(value);
}

function excelSerialToDateTime(serial: number) {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  ].join(" ");
}

function isXlsx(file: File) {
  return file.name.toLowerCase().endsWith(".xlsx") || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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

export function detectDelimiter(line: string) {
  const candidates = [
    { value: "\t", label: "TAB" },
    { value: ";", label: "ponto_virgula" },
    { value: ",", label: "virgula" },
  ];
  const best = candidates
    .map((candidate) => ({
      ...candidate,
      count: line.split(candidate.value).length - 1,
    }))
    .sort((a, b) => b.count - a.count)[0];
  return best && best.count > 0 ? best : { value: " ", label: "espaco" };
}

export function splitColumns(line: string, delimiter: string) {
  if (delimiter === " ") return line.trim().split(/\s+/);
  return line.split(delimiter).map((column) => column.trim());
}

export function parseNumber(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function sanitizeDownloadName(name: string, fallback: string) {
  const safe = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}
