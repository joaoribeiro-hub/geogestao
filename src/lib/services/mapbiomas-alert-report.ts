import type { MapBiomasAlertDetails } from "@/lib/services/mapbiomas-alert";

export type MapBiomasAlertReportInput = {
  alert: MapBiomasAlertDetails;
  alertCode: number;
  carCode: string;
  generatedAt?: Date;
};

export function buildMapBiomasAlertReportPdf({
  alert,
  alertCode,
  carCode,
  generatedAt = new Date(),
}: MapBiomasAlertReportInput) {
  const lines = buildReportLines({ alert, alertCode, carCode, generatedAt });
  const pages = chunkLines(lines.flatMap((line) => wrapLine(line, 92)), 45);
  return buildPdf(pages);
}

export function mapBiomasAlertReportFileName(carCode: string, alertCode: number) {
  const safeCar = carCode.replace(/[^a-z0-9-]+/gi, "_").slice(0, 90);
  return `laudo-geogestao-mapbiomas-${safeCar}-${alertCode}.pdf`;
}

function buildReportLines({
  alert,
  alertCode,
  carCode,
  generatedAt,
}: Required<MapBiomasAlertReportInput>) {
  const summary = {
    alertCode: valueOf(alert, "alertCode") ?? alertCode,
    areaHa: valueOf(alert, "areaHa"),
    detectedAt: valueOf(alert, "detectedAt"),
    publishedAt: valueOf(alert, "publishedAt"),
    statusName: valueOf(alert, "statusName"),
    ruralPropertiesCodes: valueOf(alert, "ruralPropertiesCodes"),
    ruralPropertiesTotal: valueOf(alert, "ruralPropertiesTotal"),
    crossedBiomesList: valueOf(alert, "crossedBiomesList"),
    crossedCitiesList: valueOf(alert, "crossedCitiesList"),
    crossedStatesList: valueOf(alert, "crossedStatesList"),
    bbox: valueOf(alert, "bbox"),
    boundingBox: valueOf(alert, "boundingBox"),
  };

  return [
    "Laudo GeoGestao - Dados MapBiomas Alerta",
    "",
    `Data de geracao: ${generatedAt.toLocaleString("pt-BR")}`,
    `CAR pesquisado: ${carCode}`,
    `Codigo do alerta: ${formatValue(summary.alertCode)}`,
    `Area do alerta: ${formatValue(summary.areaHa)} ha`,
    `Data de deteccao: ${formatValue(summary.detectedAt)}`,
    `Data de publicacao: ${formatValue(summary.publishedAt)}`,
    `Status: ${formatValue(summary.statusName)}`,
    `Fontes: ${formatValue(valueOf(alert, "sources"))}`,
    `Imoveis rurais vinculados: ${formatValue(summary.ruralPropertiesCodes)}`,
    `Total de imoveis rurais vinculados: ${formatValue(summary.ruralPropertiesTotal)}`,
    `Biomas: ${formatValue(summary.crossedBiomesList)}`,
    `Municipios: ${formatValue(summary.crossedCitiesList)}`,
    `Estados: ${formatValue(summary.crossedStatesList)}`,
    `BBox: ${formatValue(summary.bbox)}`,
    `Bounding box: ${formatValue(summary.boundingBox)}`,
    `Geometry WKT: ${truncate(formatValue(valueOf(alert, "geometryWkt")), 900)}`,
    "",
    "Observacao",
    "Documento gerado pelo GeoGestao com base nos dados retornados pela API MapBiomas Alerta.",
    "A API nao forneceu arquivo PDF oficial direto para este alerta; este arquivo e um laudo interno do GeoGestao.",
    "",
    "JSON resumido dos principais cruzamentos",
    ...JSON.stringify(summary, null, 2).split("\n"),
  ];
}

function buildPdf(pages: string[][]) {
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  const contentObjectIds = pages.map((_, index) => 5 + index * 2);
  const objects: Array<{ id: number; body: string }> = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      id: 2,
      body: `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    },
    { id: 3, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
  ];

  pages.forEach((pageLines, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];
    const stream = buildPageStream(pageLines);
    objects.push({
      id: pageObjectId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    });
    objects.push({
      id: contentObjectId,
      body: `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    });
  });

  objects.sort((a, b) => a.id - b.id);
  const maxId = objects.at(-1)?.id ?? 0;
  let pdf = "%PDF-1.4\n";
  const offsets = new Array<number>(maxId + 1).fill(0);

  for (const object of objects) {
    offsets[object.id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

function buildPageStream(lines: string[]) {
  const content = lines
    .map((line) => `(${escapePdfText(line)}) Tj\nT*`)
    .join("\n");
  return `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${content}\nET`;
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function wrapLine(line: string, maxLength: number) {
  if (line.length <= maxLength) return [line];
  const words = line.split(/\s+/);
  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) wrapped.push(current);
      current = word;
      continue;
    }
    current = `${current} ${word}`.trim();
  }
  if (current) wrapped.push(current);
  return wrapped;
}

function valueOf(record: MapBiomasAlertDetails, key: string) {
  return record[key];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return truncate(JSON.stringify(value), 600);
  return String(value);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function escapePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
