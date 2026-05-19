import type { Json } from "@/types/database";

export const officialGeoqueryLinks = {
  carConsultaPublica: "https://www.car.gov.br/#/consultar",
  carCentralAcesso: "https://www.car.gov.br/#/central/acesso",
  meuImovelRural: "https://meuimovelrural.gov.br/",
  onr: "https://registradores.onr.org.br/",
} as const;

export const geoLayerClassifications = [
  "CAR_COMPLETA",
  "CAR_TEMATICA",
  "INCRA_PERIMETROS",
  "ALERTA_DESMATAMENTO",
  "CAR_ALERT_INTERSECTION",
  "ESTADOS",
  "MUNICIPIOS",
  "BIOMAS",
  "AMAZONIA_LEGAL",
  "BACIAS_HIDROGRAFICAS",
  "UNIDADES_CONSERVACAO",
  "TERRAS_INDIGENAS",
  "ASSENTAMENTOS",
  "QUILOMBOS",
  "AREAS_EMBARGADAS",
  "AUTORIZACAO_SUPRESSAO",
  "PLANO_MANEJO",
  "RESERVA_BIOSFERA",
  "GEOPARQUES",
  "LEI_MATA_ATLANTICA",
  "AMACRO",
  "FLORESTAS_PUBLICAS",
  "BOLSA_VERDE",
  "MATOPIBA",
  "SEMIARIDO",
  "MACROREGIOES_HIDROGRAFICAS",
  "OUTROS",
] as const;

export type GeoLayerClassification = (typeof geoLayerClassifications)[number];
export type GeoTargetTable =
  | "car_properties"
  | "incra_properties"
  | "geo_alert_layers"
  | "geo_thematic_layers";

export const geoLayerTargetTable: Record<GeoLayerClassification, GeoTargetTable> = {
  CAR_COMPLETA: "car_properties",
  CAR_TEMATICA: "geo_thematic_layers",
  INCRA_PERIMETROS: "incra_properties",
  ALERTA_DESMATAMENTO: "geo_alert_layers",
  CAR_ALERT_INTERSECTION: "geo_alert_layers",
  ESTADOS: "geo_thematic_layers",
  MUNICIPIOS: "geo_thematic_layers",
  BIOMAS: "geo_thematic_layers",
  AMAZONIA_LEGAL: "geo_thematic_layers",
  BACIAS_HIDROGRAFICAS: "geo_thematic_layers",
  UNIDADES_CONSERVACAO: "geo_thematic_layers",
  TERRAS_INDIGENAS: "geo_thematic_layers",
  ASSENTAMENTOS: "geo_thematic_layers",
  QUILOMBOS: "geo_thematic_layers",
  AREAS_EMBARGADAS: "geo_alert_layers",
  AUTORIZACAO_SUPRESSAO: "geo_alert_layers",
  PLANO_MANEJO: "geo_alert_layers",
  RESERVA_BIOSFERA: "geo_thematic_layers",
  GEOPARQUES: "geo_thematic_layers",
  LEI_MATA_ATLANTICA: "geo_thematic_layers",
  AMACRO: "geo_thematic_layers",
  FLORESTAS_PUBLICAS: "geo_thematic_layers",
  BOLSA_VERDE: "geo_thematic_layers",
  MATOPIBA: "geo_thematic_layers",
  SEMIARIDO: "geo_thematic_layers",
  MACROREGIOES_HIDROGRAFICAS: "geo_thematic_layers",
  OUTROS: "geo_thematic_layers",
};

export function normalizeCarCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^\dA-Z.-]/g, "");
}

export function isValidCarCode(value: string) {
  const normalized = normalizeCarCode(value);
  return /^[A-Z]{2}[-.]?[\dA-Z.-]{10,80}$/.test(normalized);
}

export function normalizeDbfFieldName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeDbfAttributes(attributes: Record<string, unknown>) {
  return Object.entries(attributes).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normalizeDbfFieldName(key)] = value;
    return acc;
  }, {});
}

export function pickAttribute(
  attributes: Record<string, unknown>,
  candidates: string[],
) {
  const normalized = normalizeDbfAttributes(attributes);
  for (const candidate of candidates.map(normalizeDbfFieldName)) {
    const value = normalized[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

export function mapCarAttributes(attributes: Record<string, unknown>) {
  return {
    cod_car: stringOrNull(
      pickAttribute(attributes, ["cod_car", "COD_CAR", "car", "codigo_car", "cod_imovel"]),
    ),
    uf: stringOrNull(pickAttribute(attributes, ["uf", "estado", "cod_uf"])),
    municipio: stringOrNull(pickAttribute(attributes, ["municipio", "mun", "nome_munic"])),
    area_ha: numberOrNull(pickAttribute(attributes, ["area_ha", "area", "num_area"])),
    status_car: stringOrNull(pickAttribute(attributes, ["status", "status_car", "situacao"])),
  };
}

export function mapIncraAttributes(attributes: Record<string, unknown>) {
  return {
    sigef_code: stringOrNull(pickAttribute(attributes, ["sigef", "cod_sigef", "codigo_sigef"])),
    cnir: stringOrNull(pickAttribute(attributes, ["cnir", "cod_cnir"])),
    codigo_imovel: stringOrNull(
      pickAttribute(attributes, ["codigo_imovel", "cod_imovel", "cod_imob"]),
    ),
    certificacao: stringOrNull(pickAttribute(attributes, ["certificacao", "certif"])),
    situacao: stringOrNull(pickAttribute(attributes, ["situacao", "status"])),
    municipio: stringOrNull(pickAttribute(attributes, ["municipio", "mun", "nome_munic"])),
    uf: stringOrNull(pickAttribute(attributes, ["uf", "estado", "cod_uf"])),
    area_ha: numberOrNull(pickAttribute(attributes, ["area_ha", "area", "num_area"])),
  };
}

export function mapGeoAlertAttributes(attributes: Record<string, unknown>) {
  const alertCode = integerOrNull(
    pickAttribute(attributes, [
      "alert_code",
      "codigo_alerta",
      "cod_alerta",
      "alerta",
      "id_alerta",
      "code",
      "codigo",
      "alert_id",
      "alertcode",
      "codigo_do_alerta",
      "cod_mapbiomas",
    ]),
  );
  const codCar = stringOrNull(
    pickAttribute(attributes, [
      "cod_car",
      "cod_imovel",
      "codigo_imovel",
      "car_code",
      "carcode",
      "codigo_car",
      "codigo_do_car",
      "car",
      "cod_car_federal",
      "cod_imovel_car",
      "codigo_imovel_rural",
    ]),
  );
  const codImovel = stringOrNull(
    pickAttribute(attributes, [
      "cod_imovel",
      "codigo_imovel",
      "property_code",
      "imovel",
      "cod_imovel_rural",
      "codigo_imovel_rural",
    ]),
  );
  const areaIntersecaoHa = numberOrNull(
    pickAttribute(attributes, [
      "area_intersecao_ha",
      "area_intersecao",
      "intersection_area",
      "intersection_area_ha",
      "area_overlap",
      "area_sobreposta",
      "area_intersect",
      "area_intersection",
    ]),
  );
  const areaAlertaHa = numberOrNull(
    pickAttribute(attributes, [
      "area_alerta_ha",
      "area_alerta",
      "alert_area_ha",
      "alert_area",
      "area_do_alerta",
      "area_ha",
      "area",
    ]),
  );
  const alertDate = dateOrNull(
    pickAttribute(attributes, [
      "alert_date",
      "data_alerta",
      "data_deteccao",
      "detected_at",
      "published_at",
      "dt_alerta",
    ]),
  );

  return {
    cod_car: codCar,
    cod_imovel: codImovel,
    alert_code: alertCode,
    codigo_alerta: stringOrNull(
      pickAttribute(attributes, ["codigo_alerta", "cod_alerta", "alert_code", "alerta"]),
    ),
    area_intersecao_ha: areaIntersecaoHa,
    area_alerta_ha: areaAlertaHa,
    area_ha: areaAlertaHa,
    alert_date: alertDate,
  };
}

export type GeoAlertMergeCandidate = {
  id: string;
  alertCode?: number | null;
  sourceLabel?: string;
  matchType?: string | null;
  isNearbyOnly?: boolean | null;
  mapbiomasData?: Json | null;
};

export function isNearbyAlertMatch(alert: Pick<GeoAlertMergeCandidate, "isNearbyOnly" | "matchType">) {
  return alert.isNearbyOnly === true || alert.matchType === "spatial_buffer";
}

export function splitGeoAlertsByNearby<T extends GeoAlertMergeCandidate>(alerts: T[]) {
  return {
    localAlerts: alerts.filter((alert) => !isNearbyAlertMatch(alert)),
    nearbyAlerts: alerts.filter(isNearbyAlertMatch),
  };
}

export function mergeGeoAlertMatches<T extends GeoAlertMergeCandidate>(
  localAlerts: T[],
  apiAlerts: T[],
) {
  const merged = new Map<string, T>();
  localAlerts.forEach((alert) => {
    merged.set(alert.alertCode ? String(alert.alertCode) : alert.id, alert);
  });
  apiAlerts.forEach((alert) => {
    const key = alert.alertCode ? String(alert.alertCode) : alert.id;
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...existing,
        sourceLabel: "Base importada + API MapBiomas",
        mapbiomasData: alert.mapbiomasData ?? existing.mapbiomasData,
      });
      return;
    }
    merged.set(key, alert);
  });
  return [...merged.values()];
}

export function extractAlertCode(attributes: Record<string, unknown>) {
  return mapGeoAlertAttributes(attributes).alert_code;
}

export function extractAlertCarCode(attributes: Record<string, unknown>) {
  const mapped = mapGeoAlertAttributes(attributes);
  return mapped.cod_car ?? mapped.cod_imovel;
}

export function isSigefOverlapMatch(
  carOverlapRatio: number | null | undefined,
  minCarOverlap = 0.6,
) {
  return Number(carOverlapRatio ?? 0) >= minCarOverlap;
}

export function formatOverlapPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 10000) / 100}%`;
}

export function featureCollection(features: Json[]) {
  return {
    type: "FeatureCollection",
    features,
  };
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function integerOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return null;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function dateOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  if (!brDate) return null;
  return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
}
