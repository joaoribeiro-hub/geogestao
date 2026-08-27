import {
  findRw5EquipmentCandidates,
  listRw5EquipmentProfiles,
  missingRw5EquipmentFields,
  resolveRw5EquipmentProfile,
  type Rw5EquipmentProfile,
} from "@/lib/modules/rw5/equipment";
import { parseNumber, sanitizeDownloadName } from "@/lib/modules/shared-text";

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
  isRegisteredBase?: boolean;
  isControl?: boolean;
  baseId?: string;
  hrField: number;
  timestamp?: string | null;
  endTimestamp?: string | null;
  latRw5?: string | null;
  lonRw5?: string | null;
  antenna?: string | null;
  receiverModel?: string | null;
  equipmentRw5?: string | null;
  code?: string | null;
  rmsError?: number | null;
  trackedSats?: number | null;
  usedSats?: number | null;
  availableMetrics: string[];
  latLonCalculated?: boolean;
  tdopCalculated?: boolean;
  ageDefaulted?: boolean;
  satsSource?: "arquivo" | "manual" | "estimado";
  ageSource?: "arquivo" | "manual" | "estimado";
  baseElevationAlreadyCorrected?: boolean;
  rawExtra?: Record<string, unknown>;
  metrics: Rw5Metrics;
};

export type Rw5ValidationReport = {
  arquivo_origem: string;
  modo_detectado: "registered_base" | "linked_base" | "none";
  base_id_detectada: string | null;
  total_linhas_lidas: number;
  total_pontos_gerados: number;
  linhas_ignoradas: number[];
  equipamento_rover_usado: string | null;
  equipamento_base_usado: string | null;
  job_data_hora_criacao: string | null;
  primeira_data_hora_ponto: string | null;
  lat_lon_calculadas: number;
  tdop_calculado: number;
  age_padrao: number;
  avisos: string[];
  erros_bloqueantes: string[];
};

export type ParsedRw5File = {
  inputFormat: string;
  sourceFormat?: string;
  coordinateOrder: "NE" | "EN" | "unknown";
  baseMode: "registered_base" | "linked_base" | "none";
  encoding: string;
  delimiter: string;
  pointCount: number;
  baseCount: number;
  controlPointCount: number;
  alphanumericPointCount: number;
  warnings: string[];
  corrections: string[];
  headerRemoved: boolean;
  detectedAntennaType: string | null;
  detectedEquipment: string | null;
  detectedBaseAntennaType: string | null;
  baseUsed: string | null;
  crs: string;
  sourceFilename: string;
  totalLinesRead: number;
  ignoredLines: number[];
  validation: Rw5ValidationReport;
  points: Rw5Point[];
  preview: Rw5Point[];
};

export type BuildRw5Options = {
  points: Rw5Point[];
  filename: string;
  outputFilename?: string;
  crs?: string;
  equipment?: string;
  baseEquipment?: string;
  antennaRw5?: string;
  hrOffset?: number;
  jobName?: string;
  jobCreationDate?: string;
  jobCreationTime?: string;
  softwareVersion?: string;
  baseHeightType?: "Vertical" | "Slant";
  defaultAge?: number | null;
};

type EquipmentProfile = Rw5EquipmentProfile;

type ParsedRow = {
  point: Rw5Point | null;
  warning?: string;
};

const DEFAULT_CRS = "EPSG:31982";
const DEFAULT_ANTENNA = "CHCI93 NONE";
const DEFAULT_ROVER_HR = 1.7;

const LAYOUT_A_MC18_NE = "LAYOUT_A_MC18_NE";
const LAYOUT_A_LEGACY_MC19 = "LAYOUT_A_LEGACY_MC19";
const LAYOUT_B_PTS20_CHCI50_NE = "LAYOUT_B_PTS20_CHCI50_NE";
const LAYOUT_C_PTS24_NE_OR_EN = "LAYOUT_C_PTS24_NE_OR_EN";
const LAYOUT_D_PTS22_35_REGISTERED_BASE_EN = "LAYOUT_D_PTS22_35_REGISTERED_BASE_EN";
const LAYOUT_E_35_37_CHCI83_NE_OR_EN = "LAYOUT_E_35_37_CHCI83_NE_OR_EN";
const LAYOUT_F_XLSX_N_E_H_CODE = "LAYOUT_F_XLSX_N_E_H_CODE";
const LAYOUT_LEGACY_11 = "LEGADO";

export function parseRw5Text(
  text: string,
  options: { encoding?: string; sourceName?: string; crs?: string; defaultRoverHr?: number; defaultAge?: number | null } = {},
): ParsedRw5File {
  const crs = options.crs ?? DEFAULT_CRS;
  const sourceFilename = options.sourceName ?? "arquivo_sem_nome";
  const defaultRoverHr = finite(options.defaultRoverHr, DEFAULT_ROVER_HR);
  const lines = cleanLines(text);
  if (!lines.length) return emptyParsed("GENERICO", options.encoding ?? "utf-8", crs, sourceFilename, ["Arquivo TXT vazio."]);

  const delimiter = detectDelimiterFromLines(lines);
  let rows = lines.map((line) => parseDelimitedLine(line, delimiter));
  const header = rows[0] ?? [];
  const headerRemoved = looksLikeHeader(header);
  const corrections: string[] = [];
  if (headerRemoved) {
    rows = rows.slice(1);
    corrections.push("Cabecalho removido automaticamente.");
  }
  rows = rows.filter((row) => row.some((cell) => clean(cell)));

  const layout = detectLayout(rows, headerRemoved ? header : null);
  const registeredBaseIndex = rows.findIndex((row) => isRegisteredBaseId(row[0]));
  const hasRegisteredBase = registeredBaseIndex >= 0;
  const warnings: string[] = [];
  const ignoredLines: number[] = [];
  const bases: Rw5Point[] = [];
  const controls: Rw5Point[] = [];
  const rovers: Rw5Point[] = [];
  let directBase: Rw5Point | null = null;
  let registeredBase: Rw5Point | null = null;
  let coordinateOrder: "NE" | "EN" | "unknown" = "unknown";

  rows.forEach((rawRow, index) => {
    const row = pad(rawRow, 40);
    const line = index + 1 + (headerRemoved ? 1 : 0);
    const parsed = normalizeRow(row, layout, line, {
      hasRegisteredBase,
      registeredBaseIndex,
      index,
      defaultRoverHr,
      header: headerRemoved ? header : null,
    });
    if (parsed.warning) warnings.push(parsed.warning);
    const point = parsed.point;
    if (!point) {
      ignoredLines.push(line);
      return;
    }
    const rowOrder = detectCoordinateOrder(point.northing, point.easting);
    if (rowOrder !== "unknown" && coordinateOrder === "unknown") coordinateOrder = rowOrder;

    if (point.isControl) {
      controls.push(point);
      return;
    }
    if (point.isRegisteredBase) {
      registeredBase = point;
      bases.push(point);
      return;
    }
    if (point.isBase) {
      directBase = point;
      bases.push(point);
      return;
    }
    rovers.push(point);
  });

  const activeBase = [...bases].sort((first, second) => first.line - second.line)[0] ?? registeredBase ?? directBase ?? null;
  const detectedMode = activeBase ? detectBaseMode(activeBase.id) : "unknown";
  rovers.forEach((point) => {
    point.baseId = activeBase?.id ?? point.baseId ?? "";
  });

  if (!bases.length && activeBase) bases.push(activeBase);
  if (!activeBase) warnings.push("Nenhuma base valida encontrada no arquivo.");
  if (!rovers.length) warnings.push("Nenhum ponto rover valido encontrado no arquivo.");
  if (layout === LAYOUT_D_PTS22_35_REGISTERED_BASE_EN || layout === LAYOUT_E_35_37_CHCI83_NE_OR_EN) {
    corrections.push("Ordem Norte/Este detectada por magnitude, sem depender de indice fixo.");
  }

  const pointsBeforeQuality = [...(activeBase ? [activeBase] : []), ...rovers].map((point) => normalizePointCoordinates(point, crs, warnings));
  const quality = applyMissingQualityFallbacks(pointsBeforeQuality, {
    fileName: sourceFilename,
    defaultAge: options.defaultAge,
    applyAge: true,
  });
  warnings.push(...quality.warnings);
  const points = quality.points;
  const preview = points.slice(0, 20);
  const detectedAntennaType = detectAntennaType(rovers) ?? detectAntennaType(points);
  const detectedBaseAntennaType = activeBase?.antenna ?? null;
  const parsed: ParsedRw5File = {
    inputFormat: publicInputFormat(layout),
    sourceFormat: layout,
    coordinateOrder,
    baseMode: detectedMode === "registered_base" ? "registered_base" : detectedMode === "linked_base" ? "linked_base" : "none",
    encoding: options.encoding ?? "utf-8",
    delimiter: delimiterName(delimiter),
    pointCount: rovers.length,
    baseCount: activeBase ? 1 : 0,
    controlPointCount: controls.length,
    alphanumericPointCount: rovers.filter((point) => !/^\d+$/.test(point.id)).length,
    warnings,
    corrections,
    headerRemoved,
    detectedAntennaType,
    detectedEquipment: equipmentFromAntenna(detectedAntennaType),
    detectedBaseAntennaType,
    baseUsed: activeBase?.id ?? null,
    crs,
    sourceFilename,
    totalLinesRead: rows.length,
    ignoredLines,
    validation: {} as Rw5ValidationReport,
    points,
    preview,
  };
  parsed.validation = createRw5ValidationReport(parsed);
  return parsed;
}

function publicInputFormat(layout: string) {
  return layout === LAYOUT_A_LEGACY_MC19 ? "MC" : layout;
}

export function createRw5ValidationReport(
  parsed: ParsedRw5File,
  options: {
    jobCreationDate?: string | null;
    jobCreationTime?: string | null;
    roverEquipment?: string | null;
    baseEquipment?: string | null;
    defaultAge?: number | null;
    requireJobFields?: boolean;
  } = {},
): Rw5ValidationReport {
  const warnings = new Set(parsed.warnings);
  const blockers = new Set<string>();
  const quality = applyMissingQualityFallbacks(parsed.points, {
    fileName: parsed.sourceFilename,
    defaultAge: options.defaultAge,
    applyAge: true,
  });
  quality.warnings.forEach((warning) => warnings.add(warning));
  const base = quality.points.find((point) => point.isBase);
  const rovers = quality.points.filter((point) => !point.isBase);
  const firstPointDate = rovers.map((point) => parseDate(point.timestamp)).find((date): date is Date => Boolean(date)) ?? null;
  const jobDate = parseDateTimeParts(options.jobCreationDate, options.jobCreationTime);

  if (!base || parsed.baseMode === "none") blockers.add("Nao foi encontrada linha de base inicial B_ ou base_.");
  if (!rovers.length) blockers.add("Nenhum ponto rover valido foi encontrado.");
  for (const point of parsed.points) {
    if (!point.id) blockers.add(`Linha ${point.line}: identificador do ponto ausente.`);
    if (!isNorthing(point.northing) || !isEasting(point.easting) || !Number.isFinite(point.elevation)) {
      blockers.add(`Linha ${point.line} (${point.id || "sem ID"}): coordenada N/E/H invalida ou ambigua.`);
    }
    if (!point.isBase && !point.description) warnings.add(`Linha ${point.line} (${point.id}): descricao ausente.`);
    if (!point.isBase && point.rmsError === null) warnings.add(`Linha ${point.line} (${point.id}): Erro RMS ausente.`);
  }

  if (options.requireJobFields && (!options.jobCreationDate || !options.jobCreationTime || !jobDate)) {
    blockers.add("JOB_DATA_CRIACAO e JOB_HORA_CRIACAO sao obrigatorios.");
  }
  if (jobDate && firstPointDate && jobDate.getTime() >= firstPointDate.getTime()) {
    warnings.add("A data/hora de criacao da obra e igual ou posterior ao primeiro ponto medido.");
  }
  const missingAge = rovers.filter((point) => !point.availableMetrics.includes("age")).length;
  if (missingAge && !(typeof options.defaultAge === "number" && Number.isFinite(options.defaultAge))) {
    warnings.add(`${missingAge} ponto(s) sem AGE; nenhum valor padrao sera escrito.`);
  }

  return {
    arquivo_origem: parsed.sourceFilename,
    modo_detectado: parsed.baseMode,
    base_id_detectada: parsed.baseUsed,
    total_linhas_lidas: parsed.totalLinesRead,
    total_pontos_gerados: parsed.pointCount,
    linhas_ignoradas: [...parsed.ignoredLines],
    equipamento_rover_usado: options.roverEquipment ?? parsed.detectedEquipment,
    equipamento_base_usado: options.baseEquipment ?? parsed.detectedBaseAntennaType,
    job_data_hora_criacao: jobDate ? toLocalIsoDateTime(jobDate) : null,
    primeira_data_hora_ponto: firstPointDate ? toLocalIsoDateTime(firstPointDate) : null,
    lat_lon_calculadas: parsed.points.filter((point) => point.latLonCalculated).length,
    tdop_calculado: rovers.filter((point) => point.tdopCalculated).length,
    age_padrao: typeof options.defaultAge === "number" && Number.isFinite(options.defaultAge) ? missingAge : 0,
    avisos: [...warnings],
    erros_bloqueantes: [...blockers],
  };
}

export function buildBasicRw5(options: BuildRw5Options) {
  return buildRw5(options);
}

/**
 * Exports the exact LA/LN representation used by the RW5 writer.
 * Keeping this derived from the same point coordinates prevents the helper
 * spreadsheet from drifting from the generated RW5 file.
 */
export function buildRw5CoordinatesTable(points: Rw5Point[], crs = DEFAULT_CRS) {
  const rows = points.map((point) => {
    const withCoords = withRw5Coords(point, crs);
    return [point.id, withCoords.latRw5 ?? "", withCoords.lonRw5 ?? ""].join("\t");
  });
  return ["Nome\tlatitude\tlongitude", ...rows].join("\n") + "\n";
}

export function buildRw5({
  points,
  filename,
  outputFilename,
  crs = DEFAULT_CRS,
  equipment = "auto",
  baseEquipment = "auto",
  antennaRw5,
  hrOffset,
  jobName,
  jobCreationDate,
  jobCreationTime,
  softwareVersion = "8.2.0.1.20251117",
  baseHeightType,
  defaultAge,
}: BuildRw5Options) {
  const quality = applyMissingQualityFallbacks(points, {
    fileName: outputFilename || filename,
    defaultAge,
    applyAge: true,
  });
  const normalizedPoints = quality.points;
  const rovers = normalizedPoints.filter((point) => !point.isBase);
  const bases = normalizedPoints.filter((point) => point.isBase);
  const base = [...bases].sort((first, second) => first.line - second.line)[0];
  if (!base) throw new Error("Nenhuma base reconhecida para gerar RW5.");
  if (!rovers.length) throw new Error("Nenhum ponto rover reconhecido para gerar RW5.");
  const baseMode = detectBaseMode(base.id);
  if (baseMode === "unknown") throw new Error(`Tipo de base nao reconhecido: ${base.id}`);

  const resolvedJobName = sanitizeDownloadName(jobName || outputFilename || "", "").slice(0, 24);
  if (!resolvedJobName) throw new Error("JOB_NOME_RW5 e obrigatorio.");
  const jobTimestamp = parseDateTimeParts(jobCreationDate, jobCreationTime);
  if (!jobTimestamp) throw new Error("JOB_DATA_CRIACAO e JOB_HORA_CRIACAO sao obrigatorios.");

  const roverProfile = resolveRw5EquipmentProfile({
    selected: equipment,
    detected: antennaRw5 || detectAntennaType(rovers) || detectAntennaType(points),
    role: "rover",
  });
  if (Number.isFinite(hrOffset)) roverProfile.hr_offset = hrOffset!;
  const baseProfile = baseMode === "registered_base"
    ? resolveRw5EquipmentProfile({ selected: baseEquipment, detected: base.antenna, role: "base" })
    : roverProfile;
  const firstTimestamp = [...bases, ...rovers].map((point) => parseDate(point.timestamp)).find((date): date is Date => Boolean(date));
  if (!firstTimestamp) throw new Error("Nenhuma data/hora do levantamento foi reconhecida.");

  const baseWithCoords = withRw5Coords(base, crs);
  const basePhaseEl = basePhaseElevation(baseWithCoords);
  const baseForPointVectors = { ...baseWithCoords, elevation: basePhaseEl };
  const firstRover = rovers[0];
  const firstRoverHr = firstRover.hrField;
  const resolvedBaseHeightType = baseHeightType ?? (baseMode === "registered_base" ? "Vertical" : "Slant");
  const lines = [
    `JB,NM${resolvedJobName},DT${formatDate(jobTimestamp)},TM${formatTime(jobTimestamp)}`,
    "MO,AD0,UN1.0,SF1.00000000,EC0,EO0.0,AU0",
    `--Software Version ${clean(softwareVersion) || "8.2.0.1.20251117"}`,
    "User Defined: SIRGAS 2000 _ UTM zone 22S",
    "GRS 1980/32 CM -51.0S",
    "--Localization File: None",
    "--Geoid Separation File: None",
    "--Grid Adjustment File: None",
    `--Equipment: ${equipmentLine(roverProfile)}`,
    "--GPS Scale: 1.00000000",
    "--Scale Point not used",
    ...antennaBlock(firstRoverHr, roverProfile),
  ];

  if (baseMode === "registered_base") {
    lines.push(...registeredBaseBlock(baseWithCoords, baseProfile, resolvedBaseHeightType, basePhaseEl));
    lines.push(`--Equipment: ${equipmentLine(roverProfile)}`);
    lines.push(...antennaBlock(firstRoverHr, roverProfile));
  } else {
    lines.push(`--Equipment: ${equipmentLine(roverProfile)}`);
    lines.push(antennaTypeLine(roverProfile));
    lines.push(bpLine(baseWithCoords, basePhaseEl));
  }

  let previousHr: number | null = firstRoverHr;
  let previousAntenna = roverProfile.antenna_type;
  for (const rover of rovers) {
    const pointProfile = { ...roverProfile };
    if (previousHr === null || Math.abs(previousHr - rover.hrField) > 0.00005 || pointProfile.antenna_type !== previousAntenna) {
      lines.push(...antennaBlock(rover.hrField, pointProfile));
      previousHr = rover.hrField;
      previousAntenna = pointProfile.antenna_type;
    }
    lines.push(...pointBlock(rover, baseForPointVectors, crs, pointProfile));
  }

  return lines.join("\n") + "\n";
}

export function collectRw5EquipmentWarnings({
  selected = "auto",
  antennaRw5,
  detectedAntenna,
  detectedBaseAntenna,
}: {
  selected?: string;
  antennaRw5?: string | null;
  detectedAntenna?: string | null;
  detectedBaseAntenna?: string | null;
  hrOffset?: number;
}) {
  const warnings = new Set<string>();
  for (const candidate of [
    { selected, detected: antennaRw5 || detectedAntenna, role: "rover" as const },
    { selected: "auto", detected: detectedBaseAntenna, role: "base" as const },
  ]) {
    try {
      const profile = resolveRw5EquipmentProfile(candidate);
      const missing = missingRw5EquipmentFields(profile);
      if (missing.length) warnings.add(`Perfil ${profile.key} incompleto: ${missing.join(", ")}.`);
    } catch (error) {
      warnings.add(error instanceof Error ? error.message : "Perfil de equipamento invalido.");
    }
  }
  return [...warnings];
}

export function getRw5EquipmentProfiles() {
  return listRw5EquipmentProfiles();
}

function normalizeRow(
  row: string[],
  layout: string,
  line: number,
  options: {
    hasRegisteredBase: boolean;
    registeredBaseIndex: number;
    index: number;
    defaultRoverHr: number;
    header: string[] | null;
  },
): ParsedRow {
  if (layout === LAYOUT_A_MC18_NE) return normalizeLayoutA(row, line, options.defaultRoverHr);
  if (layout === LAYOUT_A_LEGACY_MC19) return normalizeLegacyMc19(row, line);
  if (layout === LAYOUT_B_PTS20_CHCI50_NE) return normalizeLayoutB(row, line);
  if (layout === LAYOUT_C_PTS24_NE_OR_EN) return normalizeLayoutC(row, line);
  if (layout === LAYOUT_D_PTS22_35_REGISTERED_BASE_EN) return normalizeLayoutD(row, line, options);
  if (layout === LAYOUT_E_35_37_CHCI83_NE_OR_EN) return normalizeLayoutE(row, line, options);
  if (layout === LAYOUT_F_XLSX_N_E_H_CODE) return normalizeLayoutF(row, line, options.defaultRoverHr, options.header);
  return normalizeLegacy(row, line);
}

function normalizeLayoutA(row: string[], line: number, defaultRoverHr: number): ParsedRow {
  const isBase = looksLikeBaseId(row[0]);
  const gnss = parseGnssInfo(row);
  return {
    point: makePoint({
      id: row[0],
      description: row[1],
      northing: safeNumber(row[2]),
      easting: safeNumber(row[3]),
      elevation: safeNumber(row[4]),
      hrField: isBase ? safeNumber(row[5], 0) : safeNumber(row[5], defaultRoverHr),
      isBase,
      baseId: isBase ? "-" : "base_1",
      pdop: optionalNumber(gnss.PDOP, row[7]),
      hdop: optionalNumber(gnss.HDOP),
      vdop: optionalNumber(gnss.VDOP),
      gdop: optionalNumber(gnss.GDOP),
      tdop: optionalNumber(gnss.TDOP),
      age: optionalNumber(gnss.AGE),
      satsSummary: optionalInt(gnss.SATS),
      satsAvg: optionalInt(gnss.SATS),
      trackedSats: optionalInt(row[8]),
      usedSats: optionalInt(row[9]),
      status: gnss.STATUS || row[10],
      nrms: optionalNumber(gnss.NRMS, row[12]),
      erms: optionalNumber(gnss.ERMS, row[13]),
      hsdv: optionalNumber(gnss.HRMS, row[14]),
      vsdv: optionalNumber(gnss.VRMS, row[15]),
      timestamp: row[16],
      endTimestamp: row[17],
      baseElevationAlreadyCorrected: isBase && safeNumber(row[5], 0) === 0,
      line,
    }),
  };
}

function normalizeLegacyMc19(row: string[], line: number): ParsedRow {
  const isBase = looksLikeBaseId(row[0]);
  const gnss = parseGnssInfo(row);
  return {
    point: makePoint({
      id: row[0],
      description: row[1],
      northing: safeNumber(row[2]),
      easting: safeNumber(row[3]),
      elevation: safeNumber(row[4]),
      hrField: isBase ? 0 : safeNumber(row[6]),
      isBase,
      baseId: isBase ? "-" : normalizeBaseReference(row[5]),
      pdop: optionalNumber(gnss.PDOP, row[8]),
      hdop: optionalNumber(gnss.HDOP),
      vdop: optionalNumber(gnss.VDOP),
      gdop: optionalNumber(gnss.GDOP),
      tdop: optionalNumber(gnss.TDOP),
      age: optionalNumber(gnss.AGE),
      satsSummary: optionalInt(gnss.SATS),
      satsAvg: optionalInt(gnss.SATS),
      trackedSats: optionalInt(row[9]),
      usedSats: optionalInt(row[10]),
      status: gnss.STATUS || row[11],
      nrms: optionalNumber(gnss.NRMS, row[13], row[12]),
      erms: optionalNumber(gnss.ERMS, row[14], row[13]),
      hsdv: optionalNumber(gnss.HRMS, row[15]),
      vsdv: optionalNumber(gnss.VRMS, row[16]),
      timestamp: row[17],
      endTimestamp: row[18],
      baseElevationAlreadyCorrected: isBase,
      line,
    }),
  };
}

function normalizeLayoutB(row: string[], line: number): ParsedRow {
  const isBase = looksLikeBaseId(row[0]);
  const gnss = parseGnssInfo(row);
  return {
    point: makePoint({
      id: row[0],
      description: row[1],
      northing: safeNumber(row[2]),
      easting: safeNumber(row[3]),
      elevation: safeNumber(row[4]),
      hrField: isBase ? 0 : safeNumber(row[14]),
      isBase,
      baseId: isBase ? "-" : "base_1",
      nrms: optionalNumber(gnss.NRMS, row[5]),
      erms: optionalNumber(gnss.ERMS, row[6]),
      hsdv: optionalNumber(gnss.HRMS),
      vsdv: optionalNumber(gnss.VRMS, row[7]),
      status: gnss.STATUS || row[8],
      pdop: optionalNumber(gnss.PDOP, row[9]),
      hdop: optionalNumber(gnss.HDOP, row[10]),
      vdop: optionalNumber(gnss.VDOP, row[11]),
      gdop: optionalNumber(gnss.GDOP, row[12]),
      tdop: optionalNumber(gnss.TDOP),
      age: optionalNumber(gnss.AGE),
      satsAvg: optionalInt(gnss.SATS),
      satsSummary: optionalInt(gnss.SATS),
      antenna: row[13],
      timestamp: row[18],
      endTimestamp: row[19],
      baseElevationAlreadyCorrected: isBase,
      line,
    }),
  };
}

function normalizeLayoutC(row: string[], line: number): ParsedRow {
  const isBase = looksLikeBaseId(row[0]);
  const pair = normalizeCoordinatePair(row[2], row[3]);
  const gnss = parseGnssInfo(row);
  return {
    point: makePoint({
      id: row[0],
      description: row[1],
      northing: pair.northing,
      easting: pair.easting,
      elevation: isBase ? safeNumber(row[15], safeNumber(row[4])) : safeNumber(row[4]),
      hrField: isBase ? 0 : safeNumber(row[18]),
      isBase,
      baseId: isBase ? "-" : "base_1",
      nrms: optionalNumber(gnss.NRMS, row[5]),
      erms: optionalNumber(gnss.ERMS, row[6]),
      hsdv: optionalNumber(gnss.HRMS),
      vsdv: optionalNumber(gnss.VRMS, row[7]),
      status: gnss.STATUS || row[8],
      pdop: optionalNumber(gnss.PDOP, row[9]),
      hdop: optionalNumber(gnss.HDOP, row[10]),
      vdop: optionalNumber(gnss.VDOP, row[11]),
      gdop: optionalNumber(gnss.GDOP, row[12]),
      tdop: optionalNumber(gnss.TDOP),
      age: optionalNumber(gnss.AGE),
      satsAvg: optionalInt(gnss.SATS),
      satsSummary: optionalInt(gnss.SATS),
      antenna: row[14],
      lonRw5: parseDmsTextToRw5Compact(row[16]),
      latRw5: parseDmsTextToRw5Compact(row[17]),
      timestamp: row[22],
      endTimestamp: row[23],
      baseElevationAlreadyCorrected: isBase && safeNumber(row[18], 0) === 0,
      line,
    }),
  };
}

function normalizeLayoutD(row: string[], line: number, options: { registeredBaseIndex: number; index: number; defaultRoverHr: number }): ParsedRow {
  const id = clean(row[0]);
  const isRegisteredBase = isRegisteredBaseId(id);
  const isControl = !isRegisteredBase && options.index < options.registeredBaseIndex && /^(MP|MC)-?\d+/i.test(id);
  const pair = normalizeCoordinatePair(row[1], row[2]);
  if (isControl) {
    return {
      point: makePoint({
        id,
        northing: pair.northing,
        easting: pair.easting,
        elevation: safeNumber(row[3]),
        hrField: 0,
        isControl: true,
        status: row[8],
        timestamp: row[19],
        endTimestamp: row[20],
        lonRw5: parseDmsTextToRw5Compact(row[17]),
        latRw5: parseDmsTextToRw5Compact(row[18]),
        line,
      }),
    };
  }
  const gnss = parseGnssInfo(row.slice(21));
  const antenna = row[14];
  const profile = profileForAntenna(antenna);
  const isBase = isRegisteredBase;
  const rawHr = isBase
    ? profile.default_base_hr ?? 0
    : options.defaultRoverHr;
  return {
    point: makePoint({
      id,
      description: isBase ? "BASE" : row[4],
      northing: pair.northing,
      easting: pair.easting,
      elevation: safeNumber(row[3]),
      hrField: rawHr,
      isBase,
      isRegisteredBase,
      baseId: isBase ? "-" : undefined,
      nrms: optionalNumber(gnss.NRMS, row[5]),
      erms: optionalNumber(gnss.ERMS, row[6]),
      vsdv: optionalNumber(gnss.VRMS, row[7]),
      hsdv: optionalNumber(gnss.HRMS),
      status: gnss.STATUS || row[8],
      pdop: optionalNumber(gnss.PDOP, row[9]),
      hdop: optionalNumber(gnss.HDOP, row[10]),
      vdop: optionalNumber(gnss.VDOP, row[11]),
      gdop: optionalNumber(gnss.GDOP, row[12]),
      tdop: optionalNumber(gnss.TDOP),
      age: optionalNumber(gnss.AGE),
      satsAvg: optionalInt(gnss.SATS),
      satsSummary: optionalInt(gnss.SATS),
      antenna,
      lonRw5: parseDmsTextToRw5Compact(row[17]),
      latRw5: parseDmsTextToRw5Compact(row[18]),
      timestamp: row[19],
      endTimestamp: row[20],
      baseElevationAlreadyCorrected: false,
      line,
    }),
    warning: !isBase ? `Linha ${line}: altura da antena nao veio no TXT; usando HR padrao ${rawHr.toFixed(3)}.` : undefined,
  };
}

function normalizeLayoutE(row: string[], line: number, options: { hasRegisteredBase: boolean; defaultRoverHr: number }): ParsedRow {
  const id = clean(row[0]);
  const isRegisteredBase = isRegisteredBaseId(id);
  const isDirectBase = looksLikeBaseId(id) && !isRegisteredBase;
  const pair = normalizeCoordinatePair(row[1], row[2]);
  const gnssStart = firstGnssIndex(row);
  const gnss = parseGnssInfo(row.slice(Math.max(gnssStart, 21)));
  const antenna = row[17] || row[14];
  const profile = profileForAntenna(antenna);
  const lonLat = detectLonLatAndTime(row, 19);
  const rawHr = isRegisteredBase || isDirectBase
    ? safeNumber(row[18], firstNumberFromText(row.join(" ")) ?? profile.default_base_hr ?? 0)
    : safeNumber(row[18], options.defaultRoverHr);
  return {
    point: makePoint({
      id,
      description: isRegisteredBase || isDirectBase ? "BASE" : row[4],
      northing: pair.northing,
      easting: pair.easting,
      elevation: safeNumber(row[3]),
      hrField: rawHr,
      isBase: isRegisteredBase || (!options.hasRegisteredBase && isDirectBase),
      isRegisteredBase,
      baseId: isRegisteredBase || isDirectBase ? "-" : undefined,
      nrms: optionalNumber(gnss.NRMS, row[5]),
      erms: optionalNumber(gnss.ERMS, row[6]),
      vsdv: optionalNumber(gnss.VRMS, row[7]),
      hsdv: optionalNumber(gnss.HRMS, row[8]),
      status: gnss.STATUS || row[14],
      pdop: optionalNumber(gnss.PDOP, row[10]),
      hdop: optionalNumber(gnss.HDOP, row[11]),
      vdop: optionalNumber(gnss.VDOP, row[12]),
      gdop: optionalNumber(gnss.GDOP, row[13]),
      tdop: optionalNumber(gnss.TDOP),
      age: optionalNumber(gnss.AGE),
      satsAvg: optionalInt(gnss.SATS, row[15]),
      satsSummary: optionalInt(gnss.SATS, row[15]),
      antenna,
      lonRw5: parseDmsTextToRw5Compact(lonLat.lon),
      latRw5: parseDmsTextToRw5Compact(lonLat.lat),
      timestamp: lonLat.start,
      endTimestamp: lonLat.end,
      baseElevationAlreadyCorrected: isDirectBase && rawHr === 0,
      line,
    }),
  };
}

function normalizeLayoutF(row: string[], line: number, defaultRoverHr: number, header: string[] | null): ParsedRow {
  if (!header) return { point: null, warning: `Linha ${line}: cabecalho XLSX ausente.` };
  const index = createHeaderIndex(header);
  const value = (name: keyof typeof index) => row[index[name] ?? -1] ?? "";
  const id = value("name");
  const isBase = looksLikeBaseId(id);
  const gnss = parseGnssInfo(row);
  const code = value("code");
  const description = value("description") || code;
  const pair = normalizeCoordinatePair(value("northing"), value("easting"));
  return {
    point: makePoint({
      id,
      code,
      description,
      northing: pair.northing,
      easting: pair.easting,
      elevation: safeNumber(value("elevation"), Number.NaN),
      hrField: safeNumber(value("antennaHeight"), isBase ? 0 : defaultRoverHr),
      isBase,
      isRegisteredBase: isRegisteredBaseId(id),
      baseId: isBase ? "-" : "base_1",
      pdop: optionalNumber(gnss.PDOP, value("pdop")),
      hdop: optionalNumber(gnss.HDOP, value("hdop")),
      vdop: optionalNumber(gnss.VDOP, value("vdop")),
      gdop: optionalNumber(gnss.GDOP, value("gdop")),
      tdop: optionalNumber(gnss.TDOP, value("tdop")),
      age: optionalNumber(gnss.AGE, value("age")),
      satsAvg: optionalInt(gnss.SATS),
      satsSummary: optionalInt(gnss.SATS),
      trackedSats: optionalInt(value("trackedSats")),
      usedSats: optionalInt(value("usedSats")),
      status: gnss.STATUS || value("solution"),
      nrms: optionalNumber(gnss.NRMS, value("precisionX")),
      erms: optionalNumber(gnss.ERMS, value("precisionY")),
      hsdv: optionalNumber(gnss.HRMS, value("horizontalError")),
      vsdv: optionalNumber(gnss.VRMS, value("verticalError")),
      rmsError: optionalNumber(value("rmsError")),
      antenna: value("receiver"),
      lonRw5: parseDmsTextToRw5Compact(value("longitude")),
      latRw5: parseDmsTextToRw5Compact(value("latitude")),
      timestamp: value("startTime"),
      endTimestamp: value("endTime"),
      baseElevationAlreadyCorrected: false,
      rawExtra: Object.fromEntries(header.map((label, column) => [label, row[column] ?? ""])),
      line,
    }),
  };
}

function normalizeLegacy(row: string[], line: number): ParsedRow {
  return {
    point: makePoint({
      id: row[0] || (line === 1 ? "base_1" : String(line - 1)),
      northing: safeNumber(row[4]),
      easting: safeNumber(row[5]),
      elevation: safeNumber(row[3]),
      isBase: line === 1,
      hrField: 0,
      status: line === 1 ? "AUTONOMOUS" : "FIXED",
      timestamp: `${row[8] ?? ""} ${row[9] ?? ""}`.trim(),
      lonRw5: decimalDegreeToRw5Compact(safeNumber(row[2])),
      latRw5: decimalDegreeToRw5Compact(safeNumber(row[1])),
      line,
    }),
  };
}

function makePoint(input: {
  id: string;
  code?: string | null;
  description?: string;
  northing: number;
  easting: number;
  elevation: number;
  isBase?: boolean;
  isRegisteredBase?: boolean;
  isControl?: boolean;
  baseId?: string;
  hrField: number;
  timestamp?: string | null;
  endTimestamp?: string | null;
  antenna?: string | null;
  latRw5?: string | null;
  lonRw5?: string | null;
  nrms?: number;
  erms?: number;
  hsdv?: number;
  vsdv?: number;
  pdop?: number;
  hdop?: number;
  vdop?: number;
  gdop?: number;
  tdop?: number;
  age?: number;
  satsAvg?: number;
  satsSummary?: number;
  status?: string;
  rmsError?: number;
  trackedSats?: number;
  usedSats?: number;
  baseElevationAlreadyCorrected?: boolean;
  rawExtra?: Record<string, unknown>;
  line: number;
}): Rw5Point {
  const antenna = normalizeAntennaType(input.antenna);
  const profile = profileForAntenna(antenna);
  const completed = completeMetrics(input);
  return {
    id: clean(input.id),
    code: clean(input.code) || null,
    description: clean(input.description),
    northing: input.northing,
    easting: input.easting,
    elevation: input.elevation,
    isBase: input.isBase,
    isRegisteredBase: input.isRegisteredBase,
    isControl: input.isControl,
    baseId: clean(input.baseId),
    hrField: input.hrField,
    timestamp: clean(input.timestamp) || null,
    endTimestamp: clean(input.endTimestamp) || null,
    antenna,
    receiverModel: antenna ? profile.receiver_model : null,
    equipmentRw5: antenna ? equipmentLine(profile) : null,
    rmsError: input.rmsError ?? null,
    trackedSats: input.trackedSats ?? null,
    usedSats: input.usedSats ?? null,
    availableMetrics: completed.available,
    tdopCalculated: completed.tdopCalculated,
    baseElevationAlreadyCorrected: input.baseElevationAlreadyCorrected,
    satsSource: completed.available.includes("satsSummary") ? "arquivo" : undefined,
    ageSource: completed.available.includes("age") ? "arquivo" : undefined,
    rawExtra: input.rawExtra,
    latRw5: input.latRw5 ?? null,
    lonRw5: input.lonRw5 ?? null,
    line: input.line,
    metrics: completed.metrics,
  };
}

function createHeaderIndex(header: string[]) {
  const normalized = header.map(key);
  const find = (...aliases: string[]) => normalized.findIndex((value) => aliases.includes(value));
  return {
    name: find("nome", "name", "id", "ponto"),
    northing: find("n", "norte", "norte n", "northing"),
    easting: find("e", "leste", "leste e", "easting"),
    elevation: find("h", "elevacao", "altitude", "elevation"),
    code: find("codigo", "code"),
    latitude: find("latitude", "lat"),
    longitude: find("longitude", "lon", "lng"),
    description: find("descricao", "description"),
    precisionX: find("precisao x", "precision x", "nrms", "nsdv"),
    precisionY: find("precisao y", "precision y", "erms", "esdv"),
    rmsError: find("erro rms", "rms error"),
    horizontalError: find("erro horizontal", "horizontal error", "hsdv", "hrms"),
    verticalError: find("erro vertical", "vertical error", "vsdv", "vrms"),
    pdop: find("pdop"),
    hdop: find("hdop"),
    vdop: find("vdop"),
    gdop: find("gdop"),
    tdop: find("tdop"),
    age: find("age", "idade correcao", "idade da correcao"),
    trackedSats: find("satelites rastreados", "sat tracked", "tracked sats"),
    usedSats: find("satelites usados", "sat used", "used sats"),
    solution: find("tipo de solucao", "solucao", "solution"),
    receiver: find("recptor", "receptor", "receiver", "tipo de antena"),
    antennaHeight: find("altura da antena", "antenna height", "hr"),
    startTime: find("horario inicial", "data hora inicial", "start time"),
    endTime: find("horario final", "data hora final", "end time"),
  };
}

function hasHeaderAlias(keys: Set<string>, ...aliases: string[]) {
  return aliases.some((alias) => keys.has(alias));
}

function detectLayout(rows: string[][], header: string[] | null) {
  if (header) {
    const keys = new Set(header.map(key));
    const hasName = hasHeaderAlias(keys, "nome", "name", "id", "ponto");
    const hasNorthing = hasHeaderAlias(keys, "n", "norte", "norte n", "northing");
    const hasEasting = hasHeaderAlias(keys, "e", "leste", "leste e", "easting");
    const hasElevation = hasHeaderAlias(keys, "h", "elevacao", "altitude", "elevation");
    if (hasName && hasNorthing && hasEasting && hasElevation) {
      return LAYOUT_F_XLSX_N_E_H_CODE;
    }
    if (keys.has("latitude") && keys.has("longitude")) return LAYOUT_LEGACY_11;
  }
  const maxCols = Math.max(0, ...rows.slice(0, 12).map((row) => row.length));
  const hasRegisteredBase = rows.some((row) => isRegisteredBaseId(row[0]));
  const hasChci83Style = rows.some((row) => normalizeAntennaType(row[17]) === "CHCI83");
  const hasChci50Style = rows.some((row) => normalizeAntennaType(row[13]) === "CHCI50");
  if (rows.some((row) => looksLikeDateTime(row[16] ?? "") && looksLikeDateTime(row[17] ?? "") && isNorthing(safeNumber(row[2])) && isEasting(safeNumber(row[3])))) {
    return LAYOUT_A_MC18_NE;
  }
  if (hasRegisteredBase && maxCols >= 35) return hasChci83Style ? LAYOUT_E_35_37_CHCI83_NE_OR_EN : LAYOUT_D_PTS22_35_REGISTERED_BASE_EN;
  if (hasRegisteredBase) return LAYOUT_D_PTS22_35_REGISTERED_BASE_EN;
  if (maxCols >= 35 || hasChci83Style) return LAYOUT_E_35_37_CHCI83_NE_OR_EN;
  if (maxCols >= 24) return LAYOUT_C_PTS24_NE_OR_EN;
  if (maxCols >= 20 && hasChci50Style) return LAYOUT_B_PTS20_CHCI50_NE;
  if (maxCols >= 19 && !isNumericCell(rows[0]?.[5])) return LAYOUT_A_LEGACY_MC19;
  if (maxCols >= 18) return LAYOUT_A_MC18_NE;
  if (maxCols >= 11) return LAYOUT_LEGACY_11;
  return "GENERICO";
}

function pointBlock(point: Rw5Point, base: Rw5Point, crs: string, profile: EquipmentProfile) {
  const timestamp = parseDate(point.timestamp) ?? parseDate(base.timestamp);
  if (!timestamp) throw new Error(`Ponto ${point.id} sem data/hora reconhecida.`);
  const withCoords = withRw5Coords(point, crs);
  const elGps = isBasePoint(point.id) ? point.elevation : point.elevation + point.hrField + profileL1(profile);
  const [dx, dy, dz] = ecefDelta(base.easting, base.northing, base.elevation, point.easting, point.northing, elGps, crs);
  const suffix = point.description ? `--${point.description}` : "--";
  const m = point.metrics;
  return [
    `GPS,PN${point.id},LA${withCoords.latRw5},LN${withCoords.lonRw5},EL${elGps.toFixed(6)},${suffix}`,
    `--GS,PN${point.id},N ${point.northing.toFixed(4)},E ${point.easting.toFixed(4)},EL${point.elevation.toFixed(4)},${suffix}`,
    `G0,${formatDateTime(timestamp)},Base ID read at rover: ${base.id}`,
    `G1,BP${base.id},PN${point.id},DX${dx.toFixed(5)},DY${dy.toFixed(5)},DZ${dz.toFixed(5)}`,
    `G2,VX${(m.nrms * m.nrms).toFixed(10)},VY${(m.erms * m.erms).toFixed(10)},VZ${((m.vsdv / 3) * (m.vsdv / 3)).toFixed(10)}`,
    `G3,XY${(-m.nrms * m.erms * 0.55).toFixed(10)},XZ${(-m.nrms * m.vsdv * 0.1).toFixed(10)},YZ${(m.erms * m.vsdv * 0.12).toFixed(10)}`,
    ...pointStatisticsBlock(point, timestamp),
  ];
}

function pointStatisticsBlock(point: Rw5Point, timestamp: Date) {
  const m = point.metrics;
  const fixedReadings = m.status === "FIXED" ? 1 : 0;
  const has = (name: string) => point.availableMetrics.includes(name);
  const summary = [
    ...(has("hsdv") ? [`HSDV: ${m.hsdv.toFixed(3)}`] : []),
    ...(has("vsdv") ? [`VSDV: ${m.vsdv.toFixed(3)}`] : []),
    `STATUS: ${m.status}`,
    ...(has("satsSummary") ? [`SATS: ${m.satsSummary}`] : []),
    ...(has("age") ? [`AGE: ${m.age.toFixed(1)}`] : []),
    ...(has("pdop") ? [`PDOP: ${m.pdop.toFixed(3)}`] : []),
    ...(has("hdop") ? [`HDOP: ${m.hdop.toFixed(3)}`] : []),
    ...(has("vdop") ? [`VDOP: ${m.vdop.toFixed(3)}`] : []),
    ...(has("tdop") ? [`TDOP: ${m.tdop.toFixed(3)}`] : []),
    ...(has("gdop") ? [`GDOP: ${m.gdop.toFixed(3)}`] : []),
    ...(has("nrms") ? [`NSDV: ${m.nrms.toFixed(3)}`] : []),
    ...(has("erms") ? [`ESDV: ${m.erms.toFixed(3)}`] : []),
  ].join(", ");
  return [
    "--Valid Readings: 1 of 1",
    `--Fixed Readings: ${fixedReadings} of 1`,
    `--Nor Min: ${point.northing.toFixed(4)} MAX: ${point.northing.toFixed(4)}`,
    `--Eas Min: ${point.easting.toFixed(4)} MAX: ${point.easting.toFixed(4)}`,
    `--Elv Min: ${point.elevation.toFixed(4)} MAX: ${point.elevation.toFixed(4)}`,
    `--Nor Avg: ${point.northing.toFixed(4)} SD: 0.0000`,
    `--Eas Avg: ${point.easting.toFixed(4)} SD: 0.0000`,
    `--Elv Avg: ${point.elevation.toFixed(4)} SD: 0.0000`,
    has("nrms") ? metricStatsLine("NRMS", m.nrms, 4) : null,
    has("erms") ? metricStatsLine("ERMS", m.erms, 4) : null,
    has("hsdv") ? metricStatsLine("HSDV", m.hsdv, 4) : null,
    has("vsdv") ? metricStatsLine("VSDV", m.vsdv, 4) : null,
    has("hdop") ? metricRangeLine("HDOP", m.hdop, 4) : null,
    has("vdop") ? metricRangeLine("VDOP", m.vdop, 4) : null,
    has("pdop") ? metricRangeLine("PDOP", m.pdop, 4) : null,
    has("age") ? metricRangeLine("AGE", m.age, 4) : null,
    has("satsAvg") ? `--Number of Satellites Avg: ${m.satsAvg} MIN: ${m.satsAvg} MAX: ${m.satsAvg}` : null,
    `--${summary}`,
    `--DT${formatDate(timestamp)}`,
    `--TM${formatTime(timestamp)}`,
  ].filter((line): line is string => Boolean(line));
}

function metricStatsLine(label: string, value: number, decimals: number) {
  const formatted = value.toFixed(decimals);
  return `--${label} Avg: ${formatted} SD: 0.0000 MIN: ${formatted} MAX: ${formatted}`;
}

function metricRangeLine(label: string, value: number, decimals: number) {
  const formatted = value.toFixed(decimals);
  return `--${label} Avg: ${formatted} MIN: ${formatted} MAX: ${formatted}`;
}

function registeredBaseBlock(
  base: Rw5Point,
  profile: EquipmentProfile,
  heightType: "Vertical" | "Slant",
  baseEl: number,
) {
  const timestamp = parseDate(base.timestamp);
  if (!timestamp) throw new Error("Base registrada sem data/hora reconhecida.");
  return [
    "--Base Configuration by Local Coordinate",
    `--DT${formatIsoDate(timestamp)}`,
    `--TM${formatTime(timestamp)}`,
    `--Entered Base HR: ${base.hrField.toFixed(3)},${heightType}`,
    antennaTypeLine(profile),
    `BP,PN,LA${base.latRw5},LN${base.lonRw5},EL${baseEl.toFixed(4)}`,
    `GS,PN,N${base.northing.toFixed(4)},E${base.easting.toFixed(4)},EL${baseEl.toFixed(4)}--BASE`,
    `--Equipment: ${equipmentLine(profile)}`,
    antennaTypeLine(profile),
  ];
}

function bpLine(base: Rw5Point, phaseElevation: number) {
  return `BP,${base.id},LA${base.latRw5},LN${base.lonRw5},EL${phaseElevation.toFixed(4)},AG0.0,PA0.0,ATAPC,SRROVER,--`;
}

function basePhaseElevation(base: Rw5Point) {
  return base.elevation;
}

export function applyMissingQualityFallbacks(
  points: Rw5Point[],
  options: {
    fileName: string;
    defaultAge?: number | null;
    applyAge?: boolean;
  },
) {
  const warnings: string[] = [];
  let lastSats: number | null = null;
  let repeatCount = 0;
  const applyAge = options.applyAge !== false;

  const nextPoints = points.map((point, index) => {
    if (point.isBase || point.isControl) return { ...point, metrics: { ...point.metrics }, availableMetrics: [...point.availableMetrics] };

    const available = new Set(point.availableMetrics);
    const metrics = { ...point.metrics };
    const next: Rw5Point = { ...point, metrics, availableMetrics: [...available] };
    const seedBase = `${options.fileName}|${point.id}|${index}`;

    const fileSats = firstValidSats(
      available.has("satsSummary") ? metrics.satsSummary : null,
      point.usedSats,
      point.trackedSats,
      available.has("satsAvg") ? metrics.satsAvg : null,
    );

    if (fileSats !== null) {
      metrics.satsSummary = fileSats;
      metrics.satsAvg = fileSats;
      available.add("satsSummary");
      available.add("satsAvg");
      next.satsSource = point.satsSource ?? "arquivo";
    } else {
      const sats = generateEstimatedSats(seedBase, lastSats, repeatCount);
      metrics.satsSummary = sats;
      metrics.satsAvg = sats;
      available.add("satsSummary");
      available.add("satsAvg");
      next.satsSource = "estimado";
      warnings.push(`Ponto ${point.id}: SATS estimado por ausencia no arquivo.`);
    }

    if (metrics.satsSummary === lastSats) {
      repeatCount += 1;
    } else {
      lastSats = metrics.satsSummary;
      repeatCount = 1;
    }

    if (applyAge) {
      const hasAge = available.has("age") && Number.isFinite(metrics.age);
      const hasFileAge = hasAge && point.ageSource !== "estimado";
      if (hasFileAge) {
        next.ageSource = point.ageSource ?? "arquivo";
      } else if (typeof options.defaultAge === "number" && Number.isFinite(options.defaultAge)) {
        metrics.age = options.defaultAge;
        available.add("age");
        next.ageSource = "manual";
        next.ageDefaulted = true;
      } else if (hasAge && point.ageSource === "estimado") {
        next.ageSource = "estimado";
      } else {
        metrics.age = generateEstimatedAge(seedBase);
        available.add("age");
        next.ageSource = "estimado";
        warnings.push(`Ponto ${point.id}: AGE estimado por ausencia no arquivo.`);
      }
    } else if (available.has("age") && Number.isFinite(metrics.age)) {
      next.ageSource = "arquivo";
    }

    next.availableMetrics = [...available];
    return next;
  });

  return { points: nextPoints, warnings };
}

function isBasePoint(pointId?: string | null) {
  return /^(B_|base_)/i.test(clean(pointId));
}

function profileL1(profile: EquipmentProfile) {
  return typeof profile.l1 === "number" && Number.isFinite(profile.l1) ? profile.l1 : 0;
}

function firstValidSats(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  }
  return null;
}

function generateEstimatedSats(seed: string, lastSats: number | null, repeatCount: number) {
  const values = [25, 26, 27, 28, 29, 30, 31, 32];
  let sats = values[Math.floor(seededRandom(seed) * values.length)] ?? 30;

  if (lastSats !== null && sats === lastSats && repeatCount >= 5) {
    const alternatives = values.filter((value) => value !== lastSats);
    sats = alternatives[Math.floor(seededRandom(`${seed}|alt`) * alternatives.length)] ?? 30;
  }

  return sats;
}

export function generateEstimatedAge(seed: string) {
  const weighted = [
    { value: 2.0, weight: 35 },
    { value: 3.0, weight: 35 },
    { value: 5.0, weight: 14 },
    { value: 6.0, weight: 13 },
    { value: 7.0, weight: 13 },
  ];
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = seededRandom(`${seed}|age`) * total;

  for (const item of weighted) {
    if (cursor < item.weight) return item.value;
    cursor -= item.weight;
  }

  return 3.0;
}

function seededRandom(seed: string) {
  const x = Math.sin(hashStringToNumber(seed)) * 10000;
  return x - Math.floor(x);
}

function hashStringToNumber(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function antennaBlock(rawHr: number, profile: EquipmentProfile) {
  return [antennaTypeLine(profile), `--Entered Rover HR: ${rawHr.toFixed(4)} m,Vertical`, `LS,HR${(rawHr + profileL1(profile)).toFixed(4)}`];
}

function antennaTypeLine(profile: EquipmentProfile) {
  return `--Antenna Type: [${profile.antenna_type}],RA${profileRaValue(profile.ra)}m,SHMP${profileFixed4Value(profile.shmp)}m,L1${profileFixed4Value(profile.l1)}m,L2${profileFixed4Value(profile.l2)}m`;
}

function equipmentLine(profile: EquipmentProfile) {
  return `${profile.receiver_model},${profile.connection},SN: ${profile.serial_number},FW: ${profile.firmware}`;
}

function profileRaValue(value: number | "xxx") {
  return typeof value === "number" ? value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : "xxx";
}

function profileFixed4Value(value: number | "xxx") {
  return typeof value === "number" ? value.toFixed(4) : "xxx";
}

function completeMetrics(input: Partial<Rw5Metrics> & { status?: string }) {
  const satsSummary = firstValidSats(input.satsSummary, input.satsAvg);
  const available: string[] = (["nrms", "erms", "hsdv", "vsdv", "pdop", "hdop", "vdop", "gdop", "tdop", "age"] as const)
    .filter((name) => typeof input[name] === "number" && Number.isFinite(input[name]));
  if (satsSummary !== null) {
    available.push("satsSummary");
    available.push("satsAvg");
  }
  const nrms = finite(input.nrms, 0.01);
  const erms = finite(input.erms, 0.01);
  const pdop = finite(input.pdop, 0);
  const hdop = finite(input.hdop, 0);
  const vdop = finite(input.vdop, 0);
  const gdop = finite(input.gdop, 0);
  const hsdv = finite(input.hsdv, Math.hypot(nrms, erms));
  const vsdv = finite(input.vsdv, 0);
  const tdopCalculated = !available.includes("tdop") && available.includes("pdop") && available.includes("gdop") && gdop >= pdop;
  const tdop = finite(input.tdop, tdopCalculated ? Math.sqrt(Math.max(gdop * gdop - pdop * pdop, 0)) : 0);
  if (tdopCalculated) available.push("tdop");
  return {
    available: [...available],
    tdopCalculated,
    metrics: {
      nrms,
      erms,
      hsdv,
      vsdv,
      pdop,
      hdop,
      vdop,
      gdop,
      tdop,
      age: finite(input.age, 0),
      satsAvg: satsSummary ?? 0,
      satsSummary: satsSummary ?? 0,
      status: normalizeSolution(input.status),
    },
  };
}

function profileForAntenna(antenna?: string | null) {
  const normalized = normalizeAntennaType(antenna) ?? DEFAULT_ANTENNA;
  const candidates = findRw5EquipmentCandidates(normalized);
  return candidates[0] ?? {
    key: "nao-cadastrado",
    aliases: [],
    receiver_model: "nao_cadastrado",
    antenna_type: normalized,
    connection: "",
    serial_number: "",
    firmware: "",
    ra: "xxx",
    shmp: "xxx",
    l1: "xxx",
    l2: "xxx",
    hr_offset: "xxx",
  };
}

function detectBaseMode(baseId: string) {
  const baseIdClean = clean(baseId);
  if (/^B_/i.test(baseIdClean)) return "registered_base";
  if (/^base_/i.test(baseIdClean)) return "linked_base";
  return "unknown";
}

function detectAntennaType(points: Rw5Point[]) {
  const counts = new Map<string, number>();
  for (const point of points) {
    const antenna = normalizeAntennaType(point.antenna);
    if (antenna) counts.set(antenna, (counts.get(antenna) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function normalizeAntennaType(value?: string | null) {
  const match = /\b(CHCI[A-Z0-9 ]*)\b/i.exec(clean(value));
  if (!match) return null;
  const antenna = match[1].toUpperCase().replace(/\s+/g, " ").trim();
  return antenna === "CHCI93" ? "CHCI93 NONE" : antenna;
}

function equipmentFromAntenna(antenna?: string | null) {
  const profile = antenna ? profileForAntenna(antenna) : null;
  return profile ? `CHC ${profile.receiver_model}` : null;
}

function withRw5Coords(point: Rw5Point, crs: string): Rw5Point {
  if (point.latRw5 && point.lonRw5) return point;
  const [latRw5, lonRw5] = rw5CoordFromUtm(point.easting, point.northing, crs);
  return { ...point, latRw5, lonRw5, latLonCalculated: true };
}

function normalizePointCoordinates(point: Rw5Point, crs: string, warnings: string[]) {
  const [calculatedLat, calculatedLon] = rw5CoordFromUtm(point.easting, point.northing, crs);
  if (!point.latRw5 || !point.lonRw5) {
    return { ...point, latRw5: calculatedLat, lonRw5: calculatedLon, latLonCalculated: true };
  }
  const providedLat = rw5CompactToDecimal(point.latRw5);
  const providedLon = rw5CompactToDecimal(point.lonRw5);
  const expectedLat = rw5CompactToDecimal(calculatedLat);
  const expectedLon = rw5CompactToDecimal(calculatedLon);
  if (
    providedLat === null || providedLon === null || expectedLat === null || expectedLon === null ||
    Math.abs(providedLat - expectedLat) > 0.00002 || Math.abs(providedLon - expectedLon) > 0.00002
  ) {
    warnings.push(`Linha ${point.line} (${point.id}): latitude/longitude divergente da UTM; coordenada UTM priorizada.`);
    return { ...point, latRw5: calculatedLat, lonRw5: calculatedLon, latLonCalculated: true };
  }
  return point;
}

function rw5CompactToDecimal(value?: string | null) {
  const parsed = Number(clean(value));
  if (!Number.isFinite(parsed)) return null;
  const sign = parsed < 0 ? -1 : 1;
  const absolute = Math.abs(parsed);
  const degrees = Math.floor(absolute);
  const minuteSecond = (absolute - degrees) * 100;
  const minutes = Math.floor(minuteSecond);
  const seconds = (minuteSecond - minutes) * 100;
  if (minutes >= 60 || seconds >= 60) return null;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

function rw5CoordFromUtm(easting: number, northing: number, crs: string) {
  const zone = crs === "EPSG:31983" ? 23 : 22;
  const { lat, lon } = utmToLatLon(easting, northing, zone, true);
  return [decimalDegreeToRw5Compact(lat), decimalDegreeToRw5Compact(lon)];
}

function parseDmsTextToRw5Compact(value?: string | null) {
  const text = clean(value);
  if (!text) return null;
  const decimal = parseNumber(text);
  if (decimal !== null && Math.abs(decimal) <= 180) return decimalDegreeToRw5Compact(decimal);
  const parts = text.match(/-?\d+(?:[.,]\d+)?/g)?.map((part) => Number(part.replace(",", "."))) ?? [];
  if (parts.length < 3) return null;
  const sign = text.includes("-") || /[SWO]$/i.test(text) ? -1 : 1;
  return decimalDegreeToRw5Compact(sign * (Math.abs(parts[0]) + parts[1] / 60 + parts[2] / 3600));
}

function decimalDegreeToRw5Compact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  const secCompact = sec.toFixed(8).padStart(11, "0").replace(".", "");
  return `${sign}${deg}.${String(min).padStart(2, "0")}${secCompact}`;
}

function normalizeCoordinatePair(firstValue: unknown, secondValue: unknown) {
  const first = safeNumber(firstValue);
  const second = safeNumber(secondValue);
  if (isNorthing(first) && isEasting(second)) return { northing: first, easting: second };
  if (isEasting(first) && isNorthing(second)) return { northing: second, easting: first };
  return { northing: first, easting: second };
}

function detectCoordinateOrder(northing: number, easting: number): "NE" | "EN" | "unknown" {
  if (isNorthing(northing) && isEasting(easting)) return "NE";
  if (isEasting(northing) && isNorthing(easting)) return "EN";
  return "unknown";
}

function isNorthing(value: number) {
  return value >= 7000000 && value <= 9500000;
}

function isEasting(value: number) {
  return value >= 100000 && value <= 900000;
}

function detectLonLatAndTime(row: string[], startIndex: number) {
  const first = clean(row[startIndex]);
  if (looksLikeDateTime(first)) {
    return { lon: null, lat: null, start: row[startIndex], end: row[startIndex + 1] };
  }
  return { lon: row[startIndex], lat: row[startIndex + 1], start: row[startIndex + 2], end: row[startIndex + 3] };
}

function firstGnssIndex(row: string[]) {
  return row.findIndex((cell) => /HRMS|VRMS|STATUS|SATS|PDOP/i.test(cell));
}

function parseGnssInfo(values: string[]) {
  const result: Record<string, string> = {};
  const joined = values.map(clean).filter(Boolean).join(" ");
  for (const [, keyName, value] of joined.matchAll(/([A-Za-z]+)\s*:\s*([^\s,;]+)/g)) {
    result[keyName.toUpperCase()] = value;
  }
  return result;
}

function firstNumberFromText(value: string) {
  const match = value.match(/(?:SH\s*=\s*)?(-?\d+(?:[.,]\d+)?)/i);
  return match ? parseNumber(match[1]) : null;
}

export function normalizeSolution(value?: string | null) {
  const raw = clean(value);
  if (!raw) return "FIXED";
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (["fixo", "fixed"].includes(normalized)) return "FIXED";
  if (["unico", "autonomo", "autonomous"].includes(normalized)) return "AUTONOMOUS";
  if (["flutuante", "float", "floating"].includes(normalized)) return "FLOAT";
  if (/^-?\d/.test(normalized)) return "FIXED";
  return raw;
}

function cleanLines(text: string) {
  return text.split(/\r?\n/).map((line) => line.replace(/^\uFEFF/, "").trim()).filter(Boolean);
}

function detectDelimiterFromLines(lines: string[]) {
  const sample = lines.slice(0, 12);
  const candidates = ["\t", ",", ";"] as const;
  return candidates
    .map((delimiter) => ({ delimiter, score: sample.reduce((sum, line) => sum + parseDelimitedLine(line, delimiter).length, 0) }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter ?? ",";
}

function parseDelimitedLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function looksLikeHeader(row: string[]) {
  const first = key(row[0] ?? "");
  if (["nome", "id", "ponto", "codigo", "name", "point"].includes(first)) return true;
  const terms = new Set(row.map(key));
  const markers = ["n", "e", "h", "base", "altura da antena", "pdop", "solucao", "latitude", "longitude", "tipo de antena"];
  return markers.filter((marker) => terms.has(marker)).length >= 3;
}

function looksLikeBaseId(value: string) {
  return /^(base_|b_)/i.test(clean(value));
}

function isRegisteredBaseId(value: string | undefined) {
  return /^B_/i.test(clean(value));
}

function normalizeBaseReference(value: string) {
  const text = clean(value);
  if (/^base_/i.test(text)) return text;
  if (/^\d+$/.test(text)) return `base_${text}`;
  return text || "base_1";
}

function isNumericCell(value: unknown) {
  return parseNumber(value) !== null;
}

function pad(row: string[], size: number) {
  return row.concat(Array(Math.max(size - row.length, 0)).fill(""));
}

function delimiterName(delimiter: string) {
  return delimiter === "\t" ? "TAB" : delimiter === "," ? "virgula" : delimiter === ";" ? "ponto e virgula" : delimiter;
}

function key(value: string) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function safeNumber(value: unknown, fallback = 0) {
  if (!clean(value)) return fallback;
  return finite(parseNumber(value), fallback);
}

function optionalNumber(...values: unknown[]) {
  for (const value of values) {
    if (!clean(value)) continue;
    const parsed = parseNumber(value);
    if (parsed !== null) return parsed;
  }
  return undefined;
}

function optionalInt(...values: unknown[]) {
  const value = optionalNumber(...values);
  return value === undefined ? undefined : Math.round(value);
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/^"|"$/g, "");
}

function parseDate(value?: string | null) {
  const text = clean(value);
  if (!text) return null;
  const normalized = text
    .replace(/^(\d{2})-(\d{2})-(\d{4})/, "$3-$1-$2")
    .replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeParts(date?: string | null, time?: string | null) {
  const dateText = clean(date);
  const timeText = clean(time);
  if (!dateText || !timeText) return null;
  return parseDate(`${dateText} ${timeText.length === 5 ? `${timeText}:00` : timeText}`);
}

function toLocalIsoDateTime(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${formatTime(date)}`;
}

function looksLikeDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}[/-]\d{2}[/-]\d{4}/.test(value);
}

function formatDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`;
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function formatDateTime(date: Date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${formatTime(date)}`;
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
  const lon0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const lon = lon0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5 / 120) / Math.cos(fp);
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
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
  const lat = (pos.lat * Math.PI) / 180;
  const lon = (pos.lon * Math.PI) / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return {
    x: (n + h) * Math.cos(lat) * Math.cos(lon),
    y: (n + h) * Math.cos(lat) * Math.sin(lon),
    z: (n * (1 - e2) + h) * Math.sin(lat),
  };
}

function emptyParsed(inputFormat: string, encoding: string, crs: string, sourceFilename: string, warnings: string[]): ParsedRw5File {
  const parsed: ParsedRw5File = {
    inputFormat,
    sourceFormat: inputFormat,
    coordinateOrder: "unknown",
    baseMode: "none",
    encoding,
    delimiter: "TAB",
    pointCount: 0,
    baseCount: 0,
    controlPointCount: 0,
    alphanumericPointCount: 0,
    warnings,
    corrections: [],
    headerRemoved: false,
    detectedAntennaType: null,
    detectedEquipment: null,
    detectedBaseAntennaType: null,
    baseUsed: null,
    crs,
    sourceFilename,
    totalLinesRead: 0,
    ignoredLines: [],
    validation: {} as Rw5ValidationReport,
    points: [],
    preview: [],
  };
  parsed.validation = createRw5ValidationReport(parsed);
  return parsed;
}
