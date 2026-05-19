import {
  geoLayerClassifications,
  geoLayerTargetTable,
  mapCarAttributes,
  mapGeoAlertAttributes,
  mapIncraAttributes,
  normalizeDbfAttributes,
  type GeoLayerClassification,
  type GeoTargetTable,
} from "../../src/lib/geoquery";
import type { GeoJsonFeature } from "./geojson-stream";

export type GeoImportRow = Record<string, unknown>;

export function parseArgs(items: string[]) {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item?.startsWith("--")) continue;
    const key = item.slice(2);
    const next = items[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

export function resolveClassification(value: string | undefined) {
  if (!value || !geoLayerClassifications.includes(value as GeoLayerClassification)) {
    return null;
  }
  return value as GeoLayerClassification;
}

export function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  optionName: string,
) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} deve ser um inteiro positivo.`);
  }
  return parsed;
}

export function sourceTypeForTargetTable(targetTable: GeoTargetTable) {
  if (targetTable === "car_properties") return "car";
  if (targetTable === "incra_properties") return "incra";
  if (targetTable === "geo_alert_layers") return "alerta";
  return "tematica";
}

export function buildGeoImportRow(
  feature: GeoJsonFeature,
  classification: GeoLayerClassification,
): GeoImportRow {
  const targetTable = geoLayerTargetTable[classification];
  const attributes = normalizeDbfAttributes(feature.properties ?? {});
  const base = {
    attributes,
    geom_geojson: {
      type: "Feature",
      properties: feature.properties ?? {},
      geometry: feature.geometry ?? null,
    },
    bbox: bboxFromGeometry(feature.geometry),
  };

  if (targetTable === "car_properties") {
    return { ...base, ...mapCarAttributes(attributes) };
  }

  if (targetTable === "incra_properties") {
    return { ...base, ...mapIncraAttributes(attributes) };
  }

  if (targetTable === "geo_alert_layers") {
    const alert = mapGeoAlertAttributes(attributes);
    return {
      ...base,
      ...alert,
      layer_type: classification.toLowerCase(),
      name: String(
        attributes.name ??
          attributes.nome ??
          (alert.alert_code ? `Alerta ${alert.alert_code}` : classification),
      ),
    };
  }

  return {
    ...base,
    layer_type: classification.toLowerCase(),
    name: String(attributes.name ?? attributes.nome ?? classification),
  };
}

export function getTargetTable(classification: GeoLayerClassification) {
  return geoLayerTargetTable[classification];
}

function bboxFromGeometry(geometry: unknown) {
  const bbox = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  visitCoordinates((geometry as { coordinates?: unknown } | null)?.coordinates, bbox);

  if (!Number.isFinite(bbox.minX) || !Number.isFinite(bbox.minY)) return null;
  return [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY];
}

function visitCoordinates(
  value: unknown,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    const x = value[0];
    const y = value[1];
    bbox.minX = Math.min(bbox.minX, x);
    bbox.minY = Math.min(bbox.minY, y);
    bbox.maxX = Math.max(bbox.maxX, x);
    bbox.maxY = Math.max(bbox.maxY, y);
    return;
  }

  value.forEach((item) => visitCoordinates(item, bbox));
}
