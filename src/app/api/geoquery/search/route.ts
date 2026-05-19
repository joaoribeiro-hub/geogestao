import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  mapGeoAlertAttributes,
  officialGeoqueryLinks,
  splitGeoAlertsByNearby,
} from "@/lib/geoquery";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { geoQuerySearchSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  CarProperty,
  Database,
  GeoAlertLayer,
  GeoAlertSearchMatch,
  GeoThematicLayer,
  IncraProperty,
  Json,
  PropertyDocument,
  PropertySearchStatus,
  SigefSpatialMatch,
} from "@/types/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = geoQuerySearchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Busca invalida." },
      { status: 400 },
    );
  }

  const {
    codCar,
    clientId,
    serviceCardId,
    propertyId,
    bufferMeters,
    includeNearbyAlerts,
    sigefMinOverlap,
    sigefBufferMeters,
  } = parsed.data;

  try {
    const carSourcesCount = await countImportedCarSources(supabase, organization.id);
    const car = await findCarProperty(supabase, organization.id, codCar);
    const status: PropertySearchStatus = car ? "found" : carSourcesCount ? "not_found" : "partial";
    const message = car
      ? "Imovel localizado na base CAR importada."
      : carSourcesCount
        ? "CAR nao encontrado na base importada."
        : "Base CAR ainda nao importada.";

    let incraResult: { matches: SigefSpatialMatch[]; warnings: string[] };
    let importedAlertResult: ReturnType<typeof emptyImportedAlertResult>;
    let documents: PropertyDocument[];

    if (car) {
      [incraResult, importedAlertResult, documents] = await Promise.all([
          findIncraMatches(
            supabase,
            organization.id,
            car,
            codCar,
            sigefMinOverlap / 100,
            sigefBufferMeters,
          ),
          findImportedAlerts(
            supabase,
            organization.id,
            codCar,
            includeNearbyAlerts,
            bufferMeters,
          ),
          findDocuments(supabase, organization.id, codCar),
        ]);
    } else {
      incraResult = { matches: [], warnings: [] };
      importedAlertResult = emptyImportedAlertResult();
      documents = await findDocuments(supabase, organization.id, codCar);
    }
    const incraMatches = incraResult.matches;

    const apiAlerts: GeoAlertMatch[] = [];
    const mergedAlerts = importedAlertResult.localAlerts;
    const alertsInside = importedAlertResult.localAlerts;
    const alertsNearby = importedAlertResult.nearbyAlerts;
    const thematicLayers: GeoThematicLayer[] = [];
    const alertDiagnostics = {
      ...importedAlertResult.diagnostics,
      apiAlerts: apiAlerts.length,
      mergedAlerts: mergedAlerts.length,
      discardedDifferentCar: 0,
    };

    const summary = {
      message,
      carFound: Boolean(car),
      incraMatches: incraMatches.length,
      alertsInside: alertsInside.length,
      alertsNearby: alertsNearby.length,
      thematicLayers: thematicLayers.length,
      bufferMeters,
      includeNearbyAlerts,
      sigefMinOverlap,
      sigefBufferMeters,
      sigefMatching: "spatial",
      warnings: incraResult.warnings,
    };

    const search = await createSearchHistory(supabase, {
      organizationId: organization.id,
      userId: user.id,
      codCar,
      clientId,
      serviceCardId,
      propertyId,
      status,
      summary,
    });

    await createSearchResults(supabase, search.id, {
      car,
      incraMatches,
      alerts: alertsInside,
      documents,
    });

    return NextResponse.json({
      status,
      codCar,
      summary,
      car,
      incra: incraMatches,
      alerts: {
        inside: alertsInside,
        nearby: alertsNearby,
      },
      localAlerts: importedAlertResult.localAlerts,
      nearbyAlerts: alertsNearby,
      apiAlerts,
      mergedAlerts,
      diagnostics: {
        alerts: alertDiagnostics,
      },
      thematicLayers,
      geojson: {
        car: car?.geom_geojson ?? null,
        incra: incraMatches.map((item) => item.geom_geojson).filter(Boolean),
        alerts: alertsInside.map((item) => item.geom_geojson).filter(Boolean),
      },
      documents,
      downloadableFiles: buildDownloads(car, incraMatches, alertsInside),
      officialLinks: officialGeoqueryLinks,
      searchId: search.id,
    });
  } catch (error) {
    console.error("geoquery.search.failed", safeErrorLog(error));
    return NextResponse.json(
      {
        error:
          "Nao foi possivel consultar a base GeoQuery. Verifique se a migration GEOQUERY-1 foi aplicada no Supabase de teste.",
      },
      { status: 500 },
    );
  }
}

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function countImportedCarSources(supabase: ServerSupabase, organizationId: string) {
  const { count, error } = await supabase
    .from("geo_data_sources")
    .select("id", { count: "exact", head: true })
    .eq("source_type", "car")
    .eq("status", "imported")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`);
  if (error) throw error;
  return count ?? 0;
}

async function findCarProperty(
  supabase: ServerSupabase,
  organizationId: string,
  codCar: string,
) {
  const { data, error } = await supabase
    .from("car_properties")
    .select("*")
    .eq("cod_car", codCar)
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findIncraMatches(
  supabase: ServerSupabase,
  organizationId: string,
  car: CarProperty,
  codCar: string,
  minCarOverlap: number,
  bufferMeters: number,
) {
  const rpcName = "find_sigef_matches_by_car_app";
  console.info("geoquery.sigef.rpc.start", {
    codCar,
    minCarOverlap,
    bufferMeters,
    rpcName,
  });

  const { data, error } = await supabase.rpc(rpcName, {
    p_cod_car: codCar,
    p_min_car_overlap: minCarOverlap,
    p_limit: 10,
    p_buffer_meters: bufferMeters,
  });

  if (error) {
    const rpcError = safeErrorLog(error);
    console.warn("geoquery.sigef.rpc.failed", {
      codCar,
      minCarOverlap,
      bufferMeters,
      rpcName,
      error: rpcError,
    });
    const fallback = await findIncraBBoxFallback(supabase, organizationId, car, minCarOverlap);
    return {
      matches: fallback,
      warnings: [
        `Cruzamento PostGIS falhou na RPC ${rpcName}: ${formatRpcErrorForWarning(rpcError)}. Foi usado fallback simples por bbox/GeoJSON.`,
      ],
    };
  }

  console.info("geoquery.sigef.rpc.success", {
    codCar,
    minCarOverlap,
    bufferMeters,
    rpcName,
    resultCount: data?.length ?? 0,
  });
  return { matches: data ?? [], warnings: [] };
}

async function findImportedAlerts(
  supabase: ServerSupabase,
  organizationId: string,
  codCar: string,
  includeNearbyAlerts: boolean,
  bufferMeters: number,
) {
  const rpcName = "find_alerts_by_car_app";
  const [directCodCarCount, directCodImovelCount] = await Promise.all([
    countAlertRowsByColumn(supabase, organizationId, "cod_car", codCar),
    countAlertRowsByColumn(supabase, organizationId, "cod_imovel", codCar),
  ]);

  const { data, error } = await supabase.rpc(rpcName, {
    p_cod_car: codCar,
    p_include_nearby: includeNearbyAlerts,
    p_buffer_meters: bufferMeters,
    p_limit: 50,
  });

  if (error) {
    console.warn("geoquery.alerts.imported.rpc.failed", {
      codCar,
      bufferMeters,
      includeNearbyAlerts,
      rpcName,
      error: safeErrorLog(error),
    });
    return findImportedAlertsFallback(supabase, organizationId, codCar);
  }

  const matches = (data ?? []).map((alert) =>
    toGeoAlertMatch(alert, "Base importada", alert.match_type),
  );
  const { localAlerts, nearbyAlerts } = splitGeoAlertsByNearby(matches);
  const diagnostics = buildAlertDiagnostics(matches, directCodCarCount + directCodImovelCount);

  logGeoqueryDev("geoquery.alerts.imported.diagnostics", {
    codCar,
    rpcName,
    includeNearbyAlerts,
    ...diagnostics,
    finalShownAlerts: localAlerts.length,
  });

  return { allAlerts: matches, localAlerts, nearbyAlerts, diagnostics };
}

async function countAlertRowsByColumn(
  supabase: ServerSupabase,
  organizationId: string,
  column: "cod_car" | "cod_imovel",
  codCar: string,
) {
  const { count, error } = await supabase
    .from("geo_alert_layers")
    .select("id", { count: "exact", head: true })
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .eq(column, codCar);

  if (error) {
    console.warn("geoquery.alerts.imported.count.failed", {
      codCar,
      column,
      error: safeErrorLog(error),
    });
    return 0;
  }
  return count ?? 0;
}

async function findImportedAlertsFallback(
  supabase: ServerSupabase,
  organizationId: string,
  codCar: string,
) {
  const rows = new Map<string, GeoAlertMatch>();
  const queries = [
    supabase
      .from("geo_alert_layers")
      .select("*")
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .eq("cod_car", codCar)
      .limit(50),
    supabase
      .from("geo_alert_layers")
      .select("*")
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .eq("cod_imovel", codCar)
      .limit(50),
  ];

  const results = await Promise.all(queries);
  for (const result of results) {
    if (result.error) {
      console.warn("geoquery.alerts.imported.fallback.failed", safeErrorLog(result.error));
      return emptyImportedAlertResult();
    }

    (result.data ?? []).forEach((alert) => {
      rows.set(alert.id, toGeoAlertMatch(alert, "Base importada", "direct_code"));
    });
  }

  const matches = [...rows.values()];
  const { localAlerts, nearbyAlerts } = splitGeoAlertsByNearby(matches);

  logGeoqueryDev("geoquery.alerts.imported.diagnostics", {
    codCar,
    rpcName: "fallback_direct_columns",
    directCodeCount: rows.size,
    attributesCodeCount: 0,
    spatialIntersectionCount: 0,
    spatialBufferCount: 0,
    geomGeojsonCount: [...rows.values()].filter((item) => Boolean(item.geom_geojson)).length,
    resultCount: rows.size,
    finalShownAlerts: localAlerts.length,
  });

  return {
    allAlerts: matches,
    localAlerts,
    nearbyAlerts,
    diagnostics: buildAlertDiagnostics(matches, rows.size),
  };
}

async function findIncraBBoxFallback(
  supabase: ServerSupabase,
  organizationId: string,
  car: CarProperty,
  minCarOverlap: number,
) {
  const carBbox = parseBbox(car.bbox);
  if (!carBbox) return [];

  const { data, error } = await supabase
    .from("incra_properties")
    .select("*")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .not("bbox", "is", null)
    .limit(200);

  if (error) throw error;

  return (data ?? [])
    .map((item) => toBboxSigefMatch(item, carBbox))
    .filter((item): item is SigefSpatialMatch => Boolean(item))
    .filter((item) => Number(item.car_overlap_ratio ?? 0) >= minCarOverlap)
    .sort(
      (a, b) =>
        Number(b.car_overlap_ratio ?? 0) - Number(a.car_overlap_ratio ?? 0) ||
        Number(b.intersection_area_ha ?? 0) - Number(a.intersection_area_ha ?? 0),
    )
    .slice(0, 10);
}

async function findDocuments(
  supabase: ServerSupabase,
  organizationId: string,
  codCar: string,
) {
  const { data, error } = await supabase
    .from("property_documents")
    .select("*")
    .eq("cod_car", codCar)
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function createSearchHistory(
  supabase: ServerSupabase,
  input: {
    organizationId: string;
    userId: string;
    codCar: string;
    clientId: string | null;
    serviceCardId: string | null;
    propertyId: string | null;
    status: PropertySearchStatus;
    summary: Json;
  },
) {
  const { data, error } = await supabase
    .from("property_searches")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      cod_car: input.codCar,
      client_id: input.clientId,
      service_card_id: input.serviceCardId,
      property_id: input.propertyId,
      status: input.status,
      result_summary: input.summary,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function createSearchResults(
  supabase: ServerSupabase,
  searchId: string,
  input: {
    car: CarProperty | null;
    incraMatches: SigefSpatialMatch[];
    alerts: GeoAlertMatch[];
    documents: PropertyDocument[];
  },
) {
  type ResultInsert = Database["public"]["Tables"]["property_search_results"]["Insert"];
  const rows: ResultInsert[] = [];

  if (input.car) {
    rows.push({
      search_id: searchId,
      result_type: "car",
      title: `CAR ${input.car.cod_car}`,
      description: input.car.municipio ? `${input.car.municipio}/${input.car.uf ?? ""}` : null,
      data: input.car as unknown as Json,
      geometry_geojson: input.car.geom_geojson,
    });
  }

  input.incraMatches.forEach((item) => {
    rows.push({
      search_id: searchId,
      result_type: "incra",
      title: item.sigef_code ?? item.cnir ?? item.codigo_imovel ?? "INCRA/SIGEF",
      description: item.municipio ? `${item.municipio}/${item.uf ?? ""}` : null,
      data: item as unknown as Json,
      geometry_geojson: item.geom_geojson,
    });
  });

  input.alerts.forEach((item) => {
    rows.push({
      search_id: searchId,
      result_type: "alerta",
      title: `Alerta ${item.alertCode ?? item.codigo_alerta ?? item.name}`,
      description: item.matchType ?? item.sourceLabel,
      data: item as unknown as Json,
      geometry_geojson: item.geom_geojson,
    });
  });

  input.documents.forEach((item) => {
    rows.push({
      search_id: searchId,
      result_type: "documento",
      title: item.title,
      description: item.document_type,
      data: item as unknown as Json,
      storage_path: item.storage_path,
      external_url: item.external_url,
    });
  });

  if (!rows.length) return;
  const { error } = await supabase.from("property_search_results").insert(rows);
  if (error) throw error;
}

function buildDownloads(
  car: CarProperty | null,
  incraMatches: SigefSpatialMatch[],
  alerts: GeoAlertMatch[],
) {
  return {
    carGeojson: car?.geom_geojson ? "available" : "unavailable",
    incraGeojson: incraMatches.some((item) => item.geom_geojson) ? "available" : "unavailable",
    alertsGeojson: alerts.some((item) => item.geom_geojson) ? "available" : "unavailable",
    shapefileZip: "future",
  };
}

type GeoAlertMatch = GeoAlertLayer & {
  alertCode: number | null;
  sourceLabel: string;
  matchType?: string | null;
  distance_m?: number | null;
  is_spatially_confirmed?: boolean | null;
  is_nearby_only?: boolean | null;
  platformUrl: string;
  mapbiomasData?: Json | null;
};

function toGeoAlertMatch(
  alert: GeoAlertLayer | GeoAlertSearchMatch,
  sourceLabel: string,
  matchType?: string | null,
): GeoAlertMatch {
  const attributes =
    alert.attributes && typeof alert.attributes === "object" && !Array.isArray(alert.attributes)
      ? (alert.attributes as Record<string, unknown>)
      : {};
  const mapped = mapGeoAlertAttributes(attributes);
  return {
    ...alert,
    alertCode:
      alert.alert_code ??
      parseAlertCode(alert.codigo_alerta) ??
      mapped.alert_code,
    cod_car: alert.cod_car ?? mapped.cod_car,
    cod_imovel: alert.cod_imovel ?? mapped.cod_imovel,
    codigo_alerta: alert.codigo_alerta ?? mapped.codigo_alerta,
    area_intersecao_ha: alert.area_intersecao_ha ?? mapped.area_intersecao_ha,
    area_alerta_ha: alert.area_alerta_ha ?? mapped.area_alerta_ha,
    area_ha: alert.area_ha ?? mapped.area_ha,
    alert_date: alert.alert_date ?? mapped.alert_date,
    sourceLabel,
    matchType,
    distance_m: "distance_m" in alert ? alert.distance_m : null,
    is_spatially_confirmed:
      "is_spatially_confirmed" in alert ? alert.is_spatially_confirmed : null,
    is_nearby_only: "is_nearby_only" in alert ? alert.is_nearby_only : matchType === "spatial_buffer",
    platformUrl: "https://plataforma.alerta.mapbiomas.org/",
  };
}

function parseAlertCode(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
}

type Bbox = [number, number, number, number];

function parseBbox(value: Json | null): Bbox | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const bbox = value.slice(0, 4).map((item) => Number(item));
  return bbox.every((item) => Number.isFinite(item)) ? (bbox as Bbox) : null;
}

function toBboxSigefMatch(item: IncraProperty, carBbox: Bbox): SigefSpatialMatch | null {
  const incraBbox = parseBbox(item.bbox);
  if (!incraBbox) return null;
  const intersection = bboxIntersection(carBbox, incraBbox);
  if (!intersection) return null;

  const carArea = bboxArea(carBbox);
  const incraArea = bboxArea(incraBbox);
  const intersectionArea = bboxArea(intersection);
  if (!carArea || !incraArea || !intersectionArea) return null;

  return {
    id: item.id,
    organization_id: item.organization_id,
    sigef_code: item.sigef_code,
    cnir: item.cnir,
    codigo_imovel: item.codigo_imovel,
    certificacao: item.certificacao,
    situacao: item.situacao,
    municipio: item.municipio,
    uf: item.uf,
    area_ha: item.area_ha,
    data_certificacao: item.data_certificacao,
    attributes: item.attributes,
    geom_geojson: item.geom_geojson,
    intersection_area_ha: intersectionArea,
    car_area_ha: carArea,
    incra_area_ha: item.area_ha ?? incraArea,
    car_overlap_ratio: intersectionArea / carArea,
    incra_overlap_ratio: intersectionArea / (item.area_ha ?? incraArea),
  };
}

function bboxIntersection(a: Bbox, b: Bbox): Bbox | null {
  const minX = Math.max(a[0], b[0]);
  const minY = Math.max(a[1], b[1]);
  const maxX = Math.min(a[2], b[2]);
  const maxY = Math.min(a[3], b[3]);
  return minX < maxX && minY < maxY ? [minX, minY, maxX, maxY] : null;
}

function bboxArea(value: Bbox) {
  return Math.max(0, value[2] - value[0]) * Math.max(0, value[3] - value[1]);
}

function safeErrorLog(error: unknown) {
  if (!error || typeof error !== "object") return { message: String(error).slice(0, 200) };
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message.slice(0, 200) : undefined,
    details: typeof record.details === "string" ? record.details.slice(0, 200) : undefined,
    hint: typeof record.hint === "string" ? record.hint.slice(0, 200) : undefined,
  };
}

function formatRpcErrorForWarning(error: ReturnType<typeof safeErrorLog>) {
  return [error.code, error.message, error.details, error.hint].filter(Boolean).join(" - ");
}

function logGeoqueryDev(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(message, payload);
}

function emptyImportedAlertResult() {
  return {
    allAlerts: [] as GeoAlertMatch[],
    localAlerts: [] as GeoAlertMatch[],
    nearbyAlerts: [] as GeoAlertMatch[],
    diagnostics: buildAlertDiagnostics([], 0),
  };
}

function buildAlertDiagnostics(alerts: GeoAlertMatch[], directColumnCount: number) {
  return {
    directColumnCount,
    directCodeCount: alerts.filter((item) => item.matchType === "direct_code").length,
    attributesCodeCount: alerts.filter((item) => item.matchType === "attributes_code").length,
    spatialIntersectionCount: alerts.filter((item) => item.matchType === "spatial_intersection")
      .length,
    nearbyAlerts: alerts.filter((item) => item.matchType === "spatial_buffer").length,
    geomGeojsonCount: alerts.filter((item) => Boolean(item.geom_geojson)).length,
    localAlerts: alerts.filter((item) => item.matchType !== "spatial_buffer").length,
    resultCount: alerts.length,
  };
}
