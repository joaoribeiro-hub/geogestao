import { parseNumber, sanitizeDownloadName, splitColumns } from "@/lib/modules/shared-text";

export type Rw5Metrics = {
  nrms: number;
  erms: number;
  hsdv: number;
  vsdv: number;
  pdop: number;
  hdop: number;
  vdop: number;
  gdop: number;
  tdop: number;
  age: number;
  satsAvg: number;
  satsSummary: number;
  status: string;
};

export type Rw5Point = {
  id: string;
  northing: number;
  easting: number;
  elevation: number;
  description?: string;
  line: number;
  isBase?: boolean;
  baseId?: string;
  hrField: number;
  timestamp?: string | null;
  latRw5?: string | null;
  lonRw5?: string | null;
  antenna?: string | null;
  metrics: Rw5Metrics;
};

export type ParsedRw5File = {
  inputFormat: string;
  encoding: string;
  delimiter: string;
  pointCount: number;
  baseCount: number;
  warnings: string[];
  corrections: string[];
  headerRemoved: boolean;
  detectedAntennaType: string | null;
  detectedEquipment: string | null;
  crs: string;
  points: Rw5Point[];
  preview: Rw5Point[];
};

export type BuildRw5Options = {
  points: Rw5Point[];
  filename: string;
  outputFilename?: string;
  crs?: string;
  equipment?: string;
  antennaRw5?: string;
  hrOffset?: number;
};

const LAYOUT_MC_19 = "MC";
const LAYOUT_PTS_24 = "PTS";
const LAYOUT_EXPORT_37 = "EXPORT_37";
const LAYOUT_LEGACY_11 = "LEGADO";
const DEFAULT_ANTENNA = "CHCI93 NONE";
const DEFAULT_HR_OFFSET = 0.0813;

const EQUIPMENT_PROFILES: Record<string, { label: string; rw5: string; antenna: string }> = {
  "CHC i93": { label: "CHC i93", rw5: "i93,CONNECTION_WIFI", antenna: "CHCI93 NONE" },
  "CHC i83": { label: "CHC i83", rw5: "i83,CONNECTION_WIFI", antenna: "CHCI83" },
  "CHC i50": { label: "CHC i50", rw5: "i50,CONNECTION_WIFI", antenna: "CHCI50" },
};

export function parseRw5Text(text: string, options: { encoding?: string; sourceName?: string; crs?: string } = {}): ParsedRw5File {
  const crs = options.crs ?? "EPSG:31982";
  const lines = cleanLines(text);
  if (!lines.length) {
    return emptyParsed("GENERICO", options.encoding ?? "utf-8", crs, ["Arquivo TXT vazio."]);
  }

  const delimiter = detectDelimiterFromLines(lines);
  let rows = lines.map((line) => splitColumns(line, delimiter));
  const headerRemoved = looksLikeHeader(rows[0] ?? []);
  const corrections: string[] = [];
  if (headerRemoved) {
    rows = rows.slice(1);
    corrections.push("Cabecalho removido automaticamente.");
  }
  rows = rows.filter((row) => row.some((cell) => clean(cell)));

  const layout = detectLayout(rows, headerRemoved ? splitColumns(lines[0] ?? "", delimiter) : null);
  const warnings: string[] = [];
  const bases: Rw5Point[] = [];
  const rovers: Rw5Point[] = [];
  const baseIdMap = new Map<string, string>();
  let activeBase = "base_1";

  rows.forEach((row, index) => {
    const line = index + 1 + (headerRemoved ? 1 : 0);
    const point = normalizeRow(pad(row, layout === LAYOUT_EXPORT_37 ? 37 : layout === LAYOUT_PTS_24 ? 24 : layout === LAYOUT_MC_19 ? 19 : 11), layout, line);
    if (!point) return;
    if (isBasePoint(point, layout, index + 1)) {
      const original = point.id || `base_${bases.length + 1}`;
      const normalized = normalizeBaseId(original, bases.length + 1);
      if (original !== normalized) corrections.push(`Base original '${original}' normalizada para '${normalized}'.`);
      point.id = normalized;
      point.baseId = "-";
      point.isBase = true;
      baseIdMap.set(original, normalized);
      activeBase = normalized;
      bases.push(point);
      return;
    }
    if (!isRoverPoint(point)) {
      warnings.push(`Linha ${line} ignorada: nao parece base nem ponto rover.`);
      return;
    }
    point.isBase = false;
    point.baseId = baseIdMap.get(point.baseId ?? "") ?? activeBase;
    rovers.push(point);
  });

  if (layout === LAYOUT_EXPORT_37) corrections.push("Colunas Leste/Norte convertidas para Norte/Este corretamente.");
  corrections.push("Arquivo convertido para formato interno MC 19 colunas.");
  if (!bases.length) warnings.push("Nenhuma base valida encontrada no arquivo.");
  if (!rovers.length) warnings.push("Nenhum ponto rover valido encontrado no arquivo.");

  const points = [...bases, ...rovers];
  const detectedAntennaType = detectAntennaType(points);
  return {
    inputFormat: layout,
    encoding: options.encoding ?? "utf-8",
    delimiter: delimiterName(delimiter),
    pointCount: rovers.length,
    baseCount: bases.length,
    warnings,
    corrections,
    headerRemoved,
    detectedAntennaType,
    detectedEquipment: equipmentFromAntenna(detectedAntennaType),
    crs,
    points,
    preview: points.slice(0, 20),
  };
}

export function buildBasicRw5(options: BuildRw5Options) {
  return buildRw5(options);
}

export function buildRw5({
  points,
  filename,
  outputFilename,
  crs = "EPSG:31982",
  equipment = "auto",
  antennaRw5,
  hrOffset = DEFAULT_HR_OFFSET,
}: BuildRw5Options) {
  const jobName = sanitizeDownloadName(outputFilename || filename, "levantamento").slice(0, 24);
  const profile = resolveEquipmentProfile(equipment, antennaRw5, detectAntennaType(points), hrOffset);
  const firstTimestamp = points.map((point) => parseDate(point.timestamp)).find(Boolean) ?? new Date();
  const baseById = new Map(points.filter((point) => point.isBase).map((point) => [point.id, withRw5Coords(point, crs)]));
  const lines = [
    `JB,NM${jobName},DT${formatDate(firstTimestamp)},TM${formatTime(firstTimestamp)}`,
    "MO,AD0,UN1.0,SF1.00000000,EC0,EO0.0,AU0",
    "--Software Version 8.2.0.1.20251117",
    "User Defined: SIRGAS 2000 _ UTM zone 22S_1",
    "GRS 1980/32 CM -51.0S",
    "--Localization File: None",
    "--Geoid Separation File: None",
    "--Grid Adjustment File: None",
    `--Equipment: ${profile.equipmentRw5}`,
    "--GPS Scale: 1.00000000",
    "--Scale Point not used",
    antennaTypeLine(profile.antennaType),
  ];

  let previousHr: number | null = null;
  const writtenBases = new Set<string>();
  const rovers = points.filter((point) => !point.isBase);

  if (!rovers.length) {
    baseById.forEach((base) => lines.push(bpLine(base)));
    return lines.join("\n") + "\n";
  }

  rovers.forEach((point) => {
    const base = baseById.get(point.baseId ?? "") ?? baseById.values().next().value;
    if (!base) throw new Error(`Ponto PN${point.id} referencia base inexistente: ${point.baseId ?? "-"}`);
    if (previousHr === null || Math.abs(previousHr - point.hrField) > 0.00005) {
      lines.push(...antennaBlock(point.hrField, profile.hrOffset, profile.antennaType));
      previousHr = point.hrField;
    }
    if (!writtenBases.has(base.id)) {
      lines.push(bpLine(base));
      writtenBases.add(base.id);
    }
    lines.push(...pointBlock(point, base, crs, profile.hrOffset));
  });

  const last = rovers.at(-1);
  if (last) lines.push(...antennaBlock(last.hrField, profile.hrOffset, profile.antennaType));
  return lines.join("\n") + "\n";
}

function normalizeRow(row: string[], layout: string, line: number): Rw5Point | null {
  if (layout === LAYOUT_MC_19) {
    return makePoint({
      id: row[0],
      description: row[1],
      northing: safeNumber(row[2]),
      easting: safeNumber(row[3]),
      elevation: safeNumber(row[4]),
      baseId: row[5] || "1",
      hrField: safeNumber(row[6]),
      observations: safeInt(row[7]),
      pdop: safeNumber(row[8]),
      trackedSats: safeInt(row[9]),
      usedSats: safeInt(row[10]),
      solution: row[11],
      rms: safeNumber(row[12]),
      precisionX: safeNumber(row[13]),
      precisionY: safeNumber(row[14]),
      horizontalError: safeNumber(row[15]),
      verticalError: safeNumber(row[16]),
      timestamp: row[17],
      line,
    });
  }
  if (layout === LAYOUT_PTS_24) {
    const precisionX = safeNumber(row[5]);
    const precisionY = safeNumber(row[6]);
    const isBase = looksLikeBaseId(row[0]);
    return makePoint({
      id: row[0],
      description: row[1],
      northing: safeNumber(row[2]),
      easting: safeNumber(row[3]),
      elevation: isBase ? safeNumber(row[15], safeNumber(row[4])) : safeNumber(row[4]),
      baseId: "1",
      hrField: safeNumber(row[18]),
      observations: isBase ? 0 : 1,
      pdop: safeNumber(row[9]),
      trackedSats: 0,
      usedSats: 0,
      solution: row[8],
      rms: Math.hypot(precisionX, precisionY),
      precisionX,
      precisionY,
      horizontalError: Math.hypot(precisionX, precisionY),
      verticalError: safeNumber(row[7]),
      timestamp: row[22],
      antenna: row[14],
      lonRw5: dmsTextToRw5Coord(row[16]),
      latRw5: dmsTextToRw5Coord(row[17]),
      hdop: safeNumber(row[10]),
      vdop: safeNumber(row[11]),
      gdop: safeNumber(row[12]),
      line,
    });
  }
  if (layout === LAYOUT_EXPORT_37) {
    const gnss = parseGnssInfo(row.slice(23));
    const precisionX = safeNumber(row[5]);
    const precisionY = safeNumber(row[6]);
    const horizontal = safeNumber(row[8], Math.hypot(precisionX, precisionY));
    return makePoint({
      id: row[0],
      description: row[4] || row[9],
      northing: safeNumber(row[2]),
      easting: safeNumber(row[1]),
      elevation: safeNumber(row[3]),
      baseId: "1",
      hrField: safeNumber(row[18]),
      observations: 1,
      pdop: safeNumber(gnss.PDOP, safeNumber(row[10])),
      trackedSats: safeInt(gnss.SATS, safeInt(row[15])),
      usedSats: safeInt(row[15]),
      solution: gnss.STATUS || row[14],
      rms: safeNumber(gnss.HRMS, horizontal),
      precisionX: safeNumber(gnss.NRMS, precisionX),
      precisionY: safeNumber(gnss.ERMS, precisionY),
      horizontalError: horizontal,
      verticalError: safeNumber(gnss.VRMS, safeNumber(row[7])),
      timestamp: row[21] || gnssDateTime(gnss),
      antenna: row[17],
      lonRw5: dmsTextToRw5Coord(row[19]),
      latRw5: dmsTextToRw5Coord(row[20]),
      hdop: safeNumber(gnss.HDOP, safeNumber(row[11])),
      vdop: safeNumber(gnss.VDOP, safeNumber(row[12])),
      gdop: safeNumber(gnss.GDOP, safeNumber(row[13])),
      line,
    });
  }
  return makePoint({
    id: row[0] || (line === 1 ? "base_1" : String(line - 1)),
    description: "",
    northing: safeNumber(row[4]),
    easting: safeNumber(row[5]),
    elevation: safeNumber(row[3]),
    baseId: "-",
    hrField: 0,
    observations: line === 1 ? 0 : 1,
    pdop: 1.093,
    trackedSats: 26,
    usedSats: 26,
    solution: line === 1 ? "AUTONOMOUS" : "FIXED",
    rms: 0.01,
    precisionX: 0.01,
    precisionY: 0.01,
    horizontalError: 0.014,
    verticalError: 0.02,
    timestamp: `${row[8] ?? ""} ${row[9] ?? ""}`.trim(),
    lonRw5: decimalDegreesToRw5Coord(safeNumber(row[2])),
    latRw5: decimalDegreesToRw5Coord(safeNumber(row[1])),
    line,
  });
}

function makePoint(input: {
  id: string;
  description?: string;
  northing: number;
  easting: number;
  elevation: number;
  baseId: string;
  hrField: number;
  observations: number;
  pdop: number;
  trackedSats: number;
  usedSats: number;
  solution?: string;
  rms: number;
  precisionX: number;
  precisionY: number;
  horizontalError: number;
  verticalError: number;
  timestamp?: string | null;
  antenna?: string | null;
  latRw5?: string | null;
  lonRw5?: string | null;
  hdop?: number;
  vdop?: number;
  gdop?: number;
  line: number;
}): Rw5Point {
  return {
    id: clean(input.id),
    description: clean(input.description),
    northing: input.northing,
    easting: input.easting,
    elevation: input.elevation,
    baseId: clean(input.baseId),
    hrField: input.hrField,
    timestamp: clean(input.timestamp) || null,
    antenna: normalizeAntennaType(input.antenna) ?? null,
    latRw5: input.latRw5 ?? null,
    lonRw5: input.lonRw5 ?? null,
    line: input.line,
    metrics: completeMetrics({
      nrms: input.precisionX,
      erms: input.precisionY,
      hsdv: input.horizontalError,
      vsdv: input.verticalError,
      pdop: input.pdop,
      hdop: input.hdop,
      vdop: input.vdop,
      gdop: input.gdop,
      satsAvg: input.usedSats || input.trackedSats || 26,
      satsSummary: input.trackedSats || input.usedSats || 26,
      status: input.solution,
    }),
  };
}

function detectLayout(rows: string[][], header: string[] | null) {
  if (header) {
    const keys = new Set(header.map(key));
    if ((keys.has("leste e") || keys.has("norte n")) && (keys.has("tipo de antena") || keys.has("elevacao"))) return LAYOUT_EXPORT_37;
    if (["nome", "codigo", "n", "e", "h", "altura da antena"].every((item) => keys.has(item))) return LAYOUT_MC_19;
    if (keys.has("id") && keys.has("latitude") && keys.has("longitude")) return LAYOUT_LEGACY_11;
  }
  const maxCols = Math.max(0, ...rows.slice(0, 10).map((row) => row.length));
  if (maxCols >= 37) return LAYOUT_EXPORT_37;
  if (maxCols >= 24) return LAYOUT_PTS_24;
  if (maxCols >= 19) return LAYOUT_MC_19;
  if (maxCols >= 11) return LAYOUT_LEGACY_11;
  return "GENERICO";
}

function cleanLines(text: string) {
  return text.split(/\r?\n/).map((line) => line.replace(/^\uFEFF/, "").trim()).filter(Boolean);
}

function detectDelimiterFromLines(lines: string[]) {
  const sample = lines.slice(0, 10);
  const candidates = ["\t", ",", ";"] as const;
  return candidates
    .map((delimiter) => ({ delimiter, score: sample.reduce((sum, line) => sum + splitColumns(line, delimiter).length, 0) }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter ?? "\t";
}

function looksLikeHeader(row: string[]) {
  const first = key(row[0] ?? "");
  if (["nome", "id", "ponto", "codigo", "name", "point"].includes(first)) return true;
  const terms = new Set(row.map(key));
  const markers = ["n", "e", "h", "base", "altura da antena", "pdop", "solucao", "latitude", "longitude", "tipo de antena"];
  return markers.filter((marker) => terms.has(marker)).length >= 3;
}

function isBasePoint(point: Rw5Point, layout: string, rowNumber: number) {
  const status = key(point.metrics.status);
  if (looksLikeBaseId(point.id)) return true;
  if (layout === LAYOUT_LEGACY_11 && rowNumber === 1) return true;
  if (point.hrField === 0 && status !== "fixo" && status !== "fixed") return true;
  return /^MP-\d+|^MC-\d+/i.test(point.id) && point.hrField === 0;
}

function isRoverPoint(point: Rw5Point) {
  return Boolean(point.id && point.northing && point.easting);
}

function withRw5Coords(point: Rw5Point, crs: string): Rw5Point {
  if (point.latRw5 && point.lonRw5) return point;
  const [latRw5, lonRw5] = rw5CoordFromUtm(point.easting, point.northing, crs);
  return { ...point, latRw5, lonRw5 };
}

function pointBlock(point: Rw5Point, base: Rw5Point, crs: string, hrOffset: number) {
  const timestamp = parseDate(point.timestamp) ?? parseDate(base.timestamp) ?? new Date();
  const [latRw5, lonRw5] = point.latRw5 && point.lonRw5 ? [point.latRw5, point.lonRw5] : rw5CoordFromUtm(point.easting, point.northing, crs);
  const hrRw5 = point.hrField + hrOffset;
  const elGps = point.elevation + hrRw5;
  const [dx, dy, dz] = ecefDelta(base.easting, base.northing, base.elevation, point.easting, point.northing, elGps, crs);
  const suffix = point.description ? `--${point.description}` : "--";
  const m = point.metrics;
  return [
    `GPS,PN${point.id},LA${latRw5},LN${lonRw5},EL${elGps.toFixed(6)},${suffix}`,
    `--GS,PN${point.id},N ${point.northing.toFixed(4)},E ${point.easting.toFixed(4)},EL${point.elevation.toFixed(4)},${suffix}`,
    `G0,${formatDateTime(timestamp)},Base ID read at rover: ${base.id}`,
    `G1,BP${base.id},PN${point.id},DX${dx.toFixed(5)},DY${dy.toFixed(5)},DZ${dz.toFixed(5)}`,
    `G2,VX${(m.nrms * m.nrms).toFixed(10)},VY${(m.erms * m.erms).toFixed(10)},VZ${((m.vsdv / 3) * (m.vsdv / 3)).toFixed(10)}`,
    `G3,XY${(-m.nrms * m.erms * 0.55).toFixed(10)},XZ${(-m.nrms * m.vsdv * 0.1).toFixed(10)},YZ${(m.erms * m.vsdv * 0.12).toFixed(10)}`,
    "--Valid Readings: 1 of 1",
    "--Fixed Readings: 1 of 1",
    `--Nor Avg: ${point.northing.toFixed(4)} SD: 0.0000`,
    `--Eas Avg: ${point.easting.toFixed(4)} SD: 0.0000`,
    `--Elv Avg: ${point.elevation.toFixed(4)} SD: 0.0000`,
    `--HSDV: ${m.hsdv.toFixed(3)}, VSDV: ${m.vsdv.toFixed(3)}, STATUS: ${m.status}, SATS: ${m.satsSummary}, AGE: ${m.age.toFixed(1)}, PDOP: ${m.pdop.toFixed(3)}, HDOP: ${m.hdop.toFixed(3)}, VDOP: ${m.vdop.toFixed(3)}, TDOP: ${m.tdop.toFixed(3)}, GDOP: ${m.gdop.toFixed(3)}, NSDV: ${m.nrms.toFixed(3)}, ESDV: ${m.erms.toFixed(3)}`,
    `--DT${formatDate(timestamp)}`,
    `--TM${formatTime(timestamp)}`,
  ];
}

function bpLine(base: Rw5Point) {
  return `BP,${base.id},LA${base.latRw5},LN${base.lonRw5},EL${base.elevation.toFixed(4)},AG0.0,PA0.0,ATAPC,SRROVER,--`;
}

function antennaBlock(rawHr: number, hrOffset: number, antennaType: string) {
  return [antennaTypeLine(antennaType), `--Entered Rover HR: ${rawHr.toFixed(4)} m,Vertical`, `LS,HR${(rawHr + hrOffset).toFixed(4)}`];
}

function antennaTypeLine(antennaType = DEFAULT_ANTENNA) {
  return `--Antenna Type: [${antennaType}],RA0.124m,SHMP0.0000m,L10.0813m,L20.0813m`;
}

function completeMetrics(input: Partial<Rw5Metrics> & { status?: string }): Rw5Metrics {
  const nrms = finite(input.nrms, 0.01);
  const erms = finite(input.erms, 0.01);
  const pdop = finite(input.pdop, 1.093);
  const hdop = finite(input.hdop, pdop * 0.513);
  const vdop = finite(input.vdop, pdop * 0.858);
  const gdop = finite(input.gdop, pdop * 1.678);
  const hsdv = finite(input.hsdv, Math.hypot(nrms, erms));
  const vsdv = finite(input.vsdv, Math.max(hsdv * 1.4, 0.02));
  return {
    nrms,
    erms,
    hsdv,
    vsdv,
    pdop,
    hdop,
    vdop,
    gdop,
    tdop: gdop > pdop ? Math.sqrt(Math.max(gdop * gdop - pdop * pdop, 0)) : 0,
    age: finite(input.age, 1),
    satsAvg: Math.round(finite(input.satsAvg, 26)),
    satsSummary: Math.round(finite(input.satsSummary, finite(input.satsAvg, 26))),
    status: normalizeStatus(input.status),
  };
}

function resolveEquipmentProfile(selected: string, manualAntenna: string | undefined, detectedAntenna: string | null, hrOffset: number) {
  const normalizedManual = normalizeAntennaType(manualAntenna);
  const normalizedDetected = normalizeAntennaType(detectedAntenna);
  let antennaType = normalizedManual || normalizedDetected || DEFAULT_ANTENNA;
  let equipmentLabel = equipmentFromAntenna(antennaType) || "CHC i93";
  if (selected && selected !== "auto" && selected !== "manual" && EQUIPMENT_PROFILES[selected]) {
    equipmentLabel = selected;
    antennaType = normalizedManual || EQUIPMENT_PROFILES[selected].antenna;
  }
  const profile = EQUIPMENT_PROFILES[equipmentLabel] ?? EQUIPMENT_PROFILES["CHC i93"];
  return { equipmentRw5: profile.rw5, antennaType, hrOffset: finite(hrOffset, DEFAULT_HR_OFFSET) };
}

function detectAntennaType(points: Rw5Point[]) {
  const counts = new Map<string, number>();
  points.filter((point) => !point.isBase).concat(points).forEach((point) => {
    const antenna = normalizeAntennaType(point.antenna);
    if (antenna) counts.set(antenna, (counts.get(antenna) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function normalizeAntennaType(value?: string | null) {
  const match = /\b(CHCI[A-Z0-9 ]*)\b/i.exec(clean(value));
  if (!match) return null;
  const antenna = match[1].toUpperCase().replace(/\s+/g, " ").trim();
  return antenna === "CHCI93" ? "CHCI93 NONE" : antenna;
}

function equipmentFromAntenna(antenna?: string | null) {
  const normalized = normalizeAntennaType(antenna);
  if (!normalized) return null;
  if (normalized.startsWith("CHCI50")) return "CHC i50";
  if (normalized.startsWith("CHCI83")) return "CHC i83";
  if (normalized.startsWith("CHCI93")) return "CHC i93";
  return null;
}

function rw5CoordFromUtm(easting: number, northing: number, crs: string) {
  const zone = crs === "EPSG:31983" ? 23 : 22;
  const { lat, lon } = utmToLatLon(easting, northing, zone, true);
  return [decimalDegreesToRw5Coord(lat), decimalDegreesToRw5Coord(lon)];
}

function utmToLatLon(easting: number, northing: number, zone: number, southern: boolean) {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const k0 = 0.9996;
  const x = easting - 500000;
  const y = southern ? northing - 10000000 : northing;
  const m = y / k0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const fp = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
  const ep2 = e2 / (1 - e2);
  const c1 = ep2 * Math.cos(fp) ** 2;
  const t1 = Math.tan(fp) ** 2;
  const n1 = a / Math.sqrt(1 - e2 * Math.sin(fp) ** 2);
  const r1 = (a * (1 - e2)) / (1 - e2 * Math.sin(fp) ** 2) ** 1.5;
  const d = x / (n1 * k0);
  const lat = fp - (n1 * Math.tan(fp) / r1) * (d * d / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4 / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6 / 720);
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const lon = lon0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5 / 120) / Math.cos(fp);
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
}

function ecefDelta(be: number, bn: number, bh: number, pe: number, pn: number, ph: number, crs: string) {
  const base = geodeticToEcef(utmToLatLon(be, bn, crs === "EPSG:31983" ? 23 : 22, true), bh);
  const point = geodeticToEcef(utmToLatLon(pe, pn, crs === "EPSG:31983" ? 23 : 22, true), ph);
  return [point.x - base.x, point.y - base.y, point.z - base.z];
}

function geodeticToEcef(pos: { lat: number; lon: number }, h: number) {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const lat = pos.lat * Math.PI / 180;
  const lon = pos.lon * Math.PI / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return {
    x: (n + h) * Math.cos(lat) * Math.cos(lon),
    y: (n + h) * Math.cos(lat) * Math.sin(lon),
    z: (n * (1 - e2) + h) * Math.sin(lat),
  };
}

function decimalDegreesToRw5Coord(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${sign}${deg}.${String(min).padStart(2, "0")}${sec.toFixed(5).padStart(8, "0")}`;
}

function dmsTextToRw5Coord(value?: string | null) {
  const text = clean(value);
  if (!text) return null;
  const numeric = parseNumber(text);
  if (numeric !== null && Math.abs(numeric) <= 180) return decimalDegreesToRw5Coord(numeric);
  const parts = text.match(/-?\d+(?:[.,]\d+)?/g)?.map((part) => Number(part.replace(",", "."))) ?? [];
  if (parts.length < 3) return null;
  const sign = text.includes("-") || /[SWO]$/i.test(text) ? -1 : 1;
  return decimalDegreesToRw5Coord(sign * (Math.abs(parts[0]) + parts[1] / 60 + parts[2] / 3600));
}

function parseDate(value?: string | null) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function formatDateTime(date: Date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${formatTime(date)}`;
}

function safeNumber(value: unknown, fallback = 0) {
  return finite(parseNumber(value), fallback);
}

function safeInt(value: unknown, fallback = 0) {
  return Math.round(safeNumber(value, fallback));
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/^"|"$/g, "");
}

function delimiterName(delimiter: string) {
  return delimiter === "\t" ? "TAB" : delimiter === "," ? "virgula" : delimiter === ";" ? "ponto e virgula" : delimiter;
}

function key(value: string) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function looksLikeBaseId(value: string) {
  return /^(base_|b_)/i.test(clean(value));
}

function normalizeBaseId(original: string, index: number) {
  const text = clean(original);
  return /^base_[12]$/i.test(text) ? text.toLowerCase() : `base_${index}`;
}

function pad(row: string[], size: number) {
  return row.concat(Array(Math.max(size - row.length, 0)).fill(""));
}

function parseGnssInfo(values: string[]) {
  const result: Record<string, string> = {};
  const joined = values.map(clean).filter(Boolean).join(" ");
  for (const [, keyName, value] of joined.matchAll(/([A-Za-z]+)\s*:\s*([^\s,;]+)/g)) result[keyName.toUpperCase()] = value;
  return result;
}

function gnssDateTime(values: Record<string, string>) {
  return `${values.DATE ?? ""} ${values.TIME ?? ""}`.trim();
}

function normalizeStatus(value?: string | null) {
  const text = clean(value).toUpperCase();
  if (text === "FIXO" || text === "FIXED") return "FIXED";
  if (text === "AUTONOMO" || text === "AUTÔNOMO" || text === "AUTONOMOUS") return "AUTONOMOUS";
  return text || "FIXED";
}

function emptyParsed(inputFormat: string, encoding: string, crs: string, warnings: string[]): ParsedRw5File {
  return {
    inputFormat,
    encoding,
    delimiter: "TAB",
    pointCount: 0,
    baseCount: 0,
    warnings,
    corrections: [],
    headerRemoved: false,
    detectedAntennaType: null,
    detectedEquipment: null,
    crs,
    points: [],
    preview: [],
  };
}
