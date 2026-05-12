import { createReadStream } from "node:fs";

export type GeoJsonFeature = {
  type: "Feature";
  properties?: Record<string, unknown> | null;
  geometry?: unknown;
  [key: string]: unknown;
};

const MAX_HEADER_CHARS = 5 * 1024 * 1024;
const MAX_FEATURE_CHARS = 128 * 1024 * 1024;

export async function* streamGeoJsonFeatures(filePath: string): AsyncGenerator<GeoJsonFeature> {
  const stream = createReadStream(filePath, {
    encoding: "utf8",
    highWaterMark: 1024 * 1024,
  });

  let phase: "findFeatures" | "readFeatures" = "findFeatures";
  let header = "";
  let currentFeature = "";
  let featureStarted = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let foundFeaturesArray = false;

  for await (const chunk of stream) {
    let text = String(chunk);

    if (phase === "findFeatures") {
      header += text;
      const featuresKeyIndex = header.indexOf('"features"');
      if (featuresKeyIndex === -1) {
        if (header.length > MAX_HEADER_CHARS) {
          throw new Error('GeoJSON invalido: chave "features" nao encontrada no inicio do arquivo.');
        }
        continue;
      }

      const colonIndex = header.indexOf(":", featuresKeyIndex);
      const arrayIndex = colonIndex === -1 ? -1 : header.indexOf("[", colonIndex);
      if (arrayIndex === -1) {
        if (header.length > MAX_HEADER_CHARS) {
          throw new Error('GeoJSON invalido: array "features" nao encontrado.');
        }
        continue;
      }

      text = header.slice(arrayIndex + 1);
      header = "";
      phase = "readFeatures";
      foundFeaturesArray = true;
    }

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (!featureStarted) {
        if (!char || /\s|,/.test(char)) continue;
        if (char === "]") return;
        if (char !== "{") {
          throw new Error(`GeoJSON invalido: feature iniciada com caractere inesperado "${char}".`);
        }

        featureStarted = true;
        currentFeature = "{";
        depth = 1;
        inString = false;
        escaped = false;
        continue;
      }

      currentFeature += char;

      if (currentFeature.length > MAX_FEATURE_CHARS) {
        throw new Error(
          "Feature GeoJSON individual muito grande para importacao segura em memoria.",
        );
      }

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
      }

      if (depth === 0) {
        const parsed = JSON.parse(currentFeature) as GeoJsonFeature;
        if (parsed.type !== "Feature") {
          throw new Error("GeoJSON invalido: item do array features nao e uma Feature.");
        }
        yield parsed;
        currentFeature = "";
        featureStarted = false;
      }
    }
  }

  if (!foundFeaturesArray) {
    throw new Error('GeoJSON invalido: array "features" nao encontrado.');
  }
  if (featureStarted) {
    throw new Error("GeoJSON invalido: feature incompleta no final do arquivo.");
  }
}
