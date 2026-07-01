import { detectDelimiter, parseNumber, splitColumns } from "@/lib/modules/shared-text";

export type RtkPoint = {
  id: string;
  northing: number;
  easting: number;
  elevation: number;
  description?: string;
  line: number;
};

export type ParsedRtkFile = {
  encoding: string;
  format: string;
  delimiter: string;
  base: RtkPoint | null;
  rovers: RtkPoint[];
  skippedLines: number;
  warnings: string[];
  preview: RtkPoint[];
};

export type CorrectedRtkPoint = RtkPoint & {
  correctedNorthing: number;
  correctedEasting: number;
  correctedElevation: number;
};

export function parseRtkText(text: string, encoding = "utf-8"): ParsedRtkFile {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const delimiter = detectRtkDelimiter(lines);
  const warnings: string[] = [];
  let skippedLines = 0;
  let base: RtkPoint | null = null;
  const rovers: RtkPoint[] = [];

  lines.forEach((line, index) => {
    const columns = splitColumns(line, delimiter);
    const parsed = parseRtkColumns(columns, index + 1);
    if (!parsed) {
      skippedLines += 1;
      return;
    }

    if (isBaseId(parsed.id)) {
      if (base) warnings.push(`Linha ${index + 1}: base adicional ignorada (${parsed.id}).`);
      base ??= parsed;
      return;
    }

    if (/^\d+$/.test(parsed.id)) {
      rovers.push(parsed);
      return;
    }

    skippedLines += 1;
  });

  if (!base) warnings.push("Nenhuma base levantada encontrada. IDs de base esperados: base_, BASE ou B_.");
  if (!rovers.length) warnings.push("Nenhum ponto rover numerico encontrado.");

  return {
    encoding,
    format: "TXT levantamento RTK/PPP",
    delimiter: delimiter === "\t" ? "TAB" : delimiter,
    base,
    rovers,
    skippedLines,
    warnings,
    preview: rovers.slice(0, 20),
  };
}

export function calculateRtkCorrection({
  base,
  correctedBase,
  rovers,
  decimals,
  outputDelimiter,
  includeCorrectedBase,
}: {
  base: RtkPoint;
  correctedBase: Pick<RtkPoint, "northing" | "easting" | "elevation">;
  rovers: RtkPoint[];
  decimals: 3 | 4;
  outputDelimiter: "\t" | "," | ";";
  includeCorrectedBase: boolean;
}) {
  const correction = {
    deltaN: correctedBase.northing - base.northing,
    deltaE: correctedBase.easting - base.easting,
    deltaH: correctedBase.elevation - base.elevation,
  };
  const correctedPoints: CorrectedRtkPoint[] = rovers.map((point) => ({
    ...point,
    correctedNorthing: point.northing + correction.deltaN,
    correctedEasting: point.easting + correction.deltaE,
    correctedElevation: point.elevation + correction.deltaH,
  }));

  const resultText = exportCorrectedText({
    base,
    correctedBase,
    correction,
    points: correctedPoints,
    decimals,
    delimiter: outputDelimiter,
    includeCorrectedBase,
  });

  return {
    correction,
    correctedPoints,
    preview: correctedPoints.slice(0, 20),
    resultText,
  };
}

function parseRtkColumns(columns: string[], line: number): RtkPoint | null {
  const [id, description = "", northingRaw, eastingRaw, elevationRaw] = columns;
  if (!id) return null;
  if (columns.length >= 5) {
    const northing = parseNumber(northingRaw);
    const easting = parseNumber(eastingRaw);
    const elevation = parseNumber(elevationRaw);
    if (northing === null || easting === null || elevation === null) return null;
    return {
      id: id.trim(),
      northing,
      easting,
      elevation,
      description: description.trim(),
      line,
    };
  }

  const numericValues = columns
    .slice(1)
    .map((value) => parseNumber(value))
    .filter((value): value is number => value !== null);
  if (numericValues.length < 3) return null;

  const [northing, easting, elevation] = numericValues;
  return {
    id: id.trim(),
    northing,
    easting,
    elevation,
    description: columns.find((value, index) => index > 0 && parseNumber(value) === null)?.trim(),
    line,
  };
}

function detectRtkDelimiter(lines: string[]) {
  const candidates = ["\t", ",", ";"] as const;
  let best = "\t";
  let bestScore = -1;
  for (const delimiter of candidates) {
    const score = lines.slice(0, 25).reduce((total, line) => {
      const count = splitColumns(line, delimiter).length;
      return total + (count >= 5 ? count : 0);
    }, 0);
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  if (bestScore > 0) return best;
  return detectDelimiter(lines.find((line) => line.trim()) ?? "").value;
}

function isBaseId(id: string) {
  const normalized = id.trim().toLowerCase();
  return normalized.startsWith("base_") || normalized === "base" || normalized.startsWith("b_");
}

function exportCorrectedText({
  correctedBase,
  correction,
  points,
  decimals,
  delimiter,
  includeCorrectedBase,
}: {
  base: RtkPoint;
  correctedBase: Pick<RtkPoint, "northing" | "easting" | "elevation">;
  correction: { deltaN: number; deltaE: number; deltaH: number };
  points: CorrectedRtkPoint[];
  decimals: 3 | 4;
  delimiter: "\t" | "," | ";";
  includeCorrectedBase: boolean;
}) {
  const rows = [
    ["ID", "NORTE", "ESTE", "ALTITUDE", "DESCRICAO"],
    [`# DeltaN=${format(correction.deltaN, decimals)}`, `DeltaE=${format(correction.deltaE, decimals)}`, `DeltaH=${format(correction.deltaH, decimals)}`, "", ""],
  ];
  if (includeCorrectedBase) {
    rows.push([
      "BASE_CORRIGIDA",
      format(correctedBase.northing, decimals),
      format(correctedBase.easting, decimals),
      format(correctedBase.elevation, decimals),
      "PPP/IBGE",
    ]);
  }
  points.forEach((point) => {
    rows.push([
      point.id,
      format(point.correctedNorthing, decimals),
      format(point.correctedEasting, decimals),
      format(point.correctedElevation, decimals),
      point.description ?? "",
    ]);
  });
  return rows.map((row) => row.join(delimiter)).join("\n") + "\n";
}

function format(value: number, decimals: 3 | 4) {
  return value.toFixed(decimals);
}
