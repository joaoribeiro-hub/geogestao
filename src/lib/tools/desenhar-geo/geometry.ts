export type SurveyMode = "azimuth" | "bearing" | "deflection";
export type DeflectionSide = "right" | "left";

export type BoundaryInput = {
  startVertex?: string;
  endVertex?: string;
  distance: number;
  direction: string;
  confrontant?: string;
  deflectionSide?: DeflectionSide;
};

export type CalculatedVertex = {
  name: string;
  easting: number;
  northing: number;
};

export type CalculatedLine = {
  start: string;
  end: string;
  distance: number;
  azimuth: number;
  confrontant: string;
};

export type PerimeterResult = {
  vertices: CalculatedVertex[];
  lines: CalculatedLine[];
  perimeter: number;
  deltaE: number;
  deltaN: number;
  closureError: number;
};

export function parseDms(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) throw new Error("Informe um ângulo.");
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric;

  const parts = normalized.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!parts.length) throw new Error(`Ângulo inválido: ${value}`);

  const sign = parts[0] < 0 ? -1 : 1;
  const degrees = Math.abs(parts[0]);
  const minutes = Math.abs(parts[1] ?? 0);
  const seconds = Math.abs(parts[2] ?? 0);
  if (minutes >= 60 || seconds >= 60) throw new Error(`Minutos ou segundos inválidos: ${value}`);
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

export function normalizeAzimuth(value: number) {
  return ((value % 360) + 360) % 360;
}

export function parseAzimuthInput(value: string) {
  return normalizeAzimuth(parseDms(value));
}

export function parseBearingInput(value: string) {
  const raw = removeDiacritics(value).toUpperCase().replace(/[,;]/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) throw new Error("Informe um rumo.");

  const compact = raw.replace(/\s/g, "");
  let northSouth: "N" | "S" | null = null;
  let eastWest: "E" | "W" | "O" | null = null;

  if (/^[NS]/.test(compact) && /[EWO]$/.test(compact)) {
    northSouth = compact[0] as "N" | "S";
    eastWest = compact[compact.length - 1] as "E" | "W" | "O";
  } else if (/(NE|NW|NO|SE|SW|SO)$/.test(compact)) {
    const quadrant = compact.slice(-2);
    northSouth = quadrant[0] as "N" | "S";
    eastWest = quadrant[1] as "E" | "W" | "O";
  }

  if (!northSouth || !eastWest) {
    throw new Error(`Rumo inválido: ${value}`);
  }

  const angle = parseDms(raw.replace(/[NSEWO]/g, " "));
  if (angle < 0 || angle > 90) {
    throw new Error("O ângulo do rumo precisa estar entre 0° e 90°.");
  }

  const west = eastWest === "W" || eastWest === "O";
  if (northSouth === "N" && !west) return angle;
  if (northSouth === "S" && !west) return 180 - angle;
  if (northSouth === "S" && west) return 180 + angle;
  return 360 - angle;
}

export function calculatePerimeter({
  mode,
  rows,
  initialEasting = 0,
  initialNorthing = 0,
  initialAzimuth = "0",
}: {
  mode: SurveyMode;
  rows: BoundaryInput[];
  initialEasting?: number;
  initialNorthing?: number;
  initialAzimuth?: string;
}): PerimeterResult {
  if (!rows.length) throw new Error("Adicione ao menos uma divisa.");

  const vertices: CalculatedVertex[] = [
    { name: rows[0]?.startVertex?.trim() || "V01", easting: initialEasting, northing: initialNorthing },
  ];
  const lines: CalculatedLine[] = [];
  let currentAzimuth = mode === "deflection" ? parseAzimuthInput(initialAzimuth) : 0;
  let currentEasting = initialEasting;
  let currentNorthing = initialNorthing;

  rows.forEach((row, index) => {
    if (!Number.isFinite(row.distance) || row.distance <= 0) {
      throw new Error(`Distância inválida na linha ${index + 1}.`);
    }

    const start = row.startVertex?.trim() || vertices[vertices.length - 1]?.name || formatVertex(index + 1);
    const end = row.endVertex?.trim() || formatVertex(index + 2);

    if (mode === "azimuth") {
      currentAzimuth = parseAzimuthInput(row.direction);
    } else if (mode === "bearing") {
      currentAzimuth = parseBearingInput(row.direction);
    } else {
      const deflection = parseDms(row.direction);
      currentAzimuth = normalizeAzimuth(
        row.deflectionSide === "left" ? currentAzimuth - deflection : currentAzimuth + deflection,
      );
    }

    const radians = (currentAzimuth * Math.PI) / 180;
    currentEasting += Math.sin(radians) * row.distance;
    currentNorthing += Math.cos(radians) * row.distance;

    lines.push({
      start,
      end,
      distance: row.distance,
      azimuth: currentAzimuth,
      confrontant: row.confrontant?.trim() || "-",
    });
    vertices.push({ name: end, easting: currentEasting, northing: currentNorthing });
  });

  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const deltaE = last.easting - first.easting;
  const deltaN = last.northing - first.northing;

  return {
    vertices,
    lines,
    perimeter: rows.reduce((sum, row) => sum + row.distance, 0),
    deltaE,
    deltaN,
    closureError: Math.hypot(deltaE, deltaN),
  };
}

export function formatAngle(value: number) {
  const normalized = normalizeAzimuth(value);
  const degrees = Math.floor(normalized);
  const minutesFloat = (normalized - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return `${degrees}°${String(minutes).padStart(2, "0")}'${seconds.toFixed(2).padStart(5, "0")}"`;
}

export function createDxf(result: PerimeterResult) {
  const lines = [
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ...result.lines.flatMap((line, index) => {
      const start = result.vertices[index];
      const end = result.vertices[index + 1];
      return [
        "0",
        "LINE",
        "8",
        "PERIMETRO",
        "10",
        start.easting.toFixed(3),
        "20",
        start.northing.toFixed(3),
        "30",
        "0",
        "11",
        end.easting.toFixed(3),
        "21",
        end.northing.toFixed(3),
        "31",
        "0",
        "0",
        "TEXT",
        "8",
        "ROTULOS_DIVISAS",
        "10",
        ((start.easting + end.easting) / 2).toFixed(3),
        "20",
        ((start.northing + end.northing) / 2).toFixed(3),
        "30",
        "0",
        "40",
        "2.5",
        "1",
        `${line.distance.toFixed(2)} m - ${line.confrontant}`,
      ];
    }),
    ...result.vertices.flatMap((vertex) => [
      "0",
      "POINT",
      "8",
      "VERTICES",
      "10",
      vertex.easting.toFixed(3),
      "20",
      vertex.northing.toFixed(3),
      "30",
      "0",
      "0",
      "TEXT",
      "8",
      "ROTULOS_VERTICES",
      "10",
      vertex.easting.toFixed(3),
      "20",
      vertex.northing.toFixed(3),
      "30",
      "0",
      "40",
      "2.5",
      "1",
      vertex.name,
    ]),
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ];
  return `${lines.join("\n")}\n`;
}

function formatVertex(index: number) {
  return `V${String(index).padStart(2, "0")}`;
}

function removeDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
