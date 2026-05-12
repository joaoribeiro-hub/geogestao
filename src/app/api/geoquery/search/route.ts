import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { officialGeoqueryLinks } from "@/lib/geoquery";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { geoQuerySearchSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  CarProperty,
  Database,
  GeoAlertLayer,
  GeoThematicLayer,
  IncraProperty,
  Json,
  PropertyDocument,
  PropertySearchStatus,
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

  const { codCar, clientId, serviceCardId, propertyId, bufferMeters } = parsed.data;

  try {
    const carSourcesCount = await countImportedCarSources(supabase, organization.id);
    const car = await findCarProperty(supabase, organization.id, codCar);
    const status: PropertySearchStatus = car ? "found" : carSourcesCount ? "not_found" : "partial";
    const message = car
      ? "Imovel localizado na base CAR importada."
      : carSourcesCount
        ? "CAR nao encontrado na base importada."
        : "Base CAR ainda nao importada.";

    const [incraMatches, documents] = car
      ? await Promise.all([
          findIncraMatches(supabase, organization.id, car),
          findDocuments(supabase, organization.id, codCar),
        ])
      : [[], await findDocuments(supabase, organization.id, codCar)];

    const alertsInside: GeoAlertLayer[] = [];
    const alertsNearby: GeoAlertLayer[] = [];
    const thematicLayers: GeoThematicLayer[] = [];

    const summary = {
      message,
      carFound: Boolean(car),
      incraMatches: incraMatches.length,
      alertsInside: alertsInside.length,
      alertsNearby: alertsNearby.length,
      thematicLayers: thematicLayers.length,
      bufferMeters,
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
      thematicLayers,
      geojson: {
        car: car?.geom_geojson ?? null,
        incra: incraMatches.map((item) => item.geom_geojson).filter(Boolean),
        alerts: [],
      },
      documents,
      downloadableFiles: buildDownloads(car, incraMatches),
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
) {
  let query = supabase
    .from("incra_properties")
    .select("*")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .limit(8);

  if (car.uf) query = query.eq("uf", car.uf);
  if (car.municipio) query = query.ilike("municipio", car.municipio);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
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
    incraMatches: IncraProperty[];
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

function buildDownloads(car: CarProperty | null, incraMatches: IncraProperty[]) {
  return {
    carGeojson: car?.geom_geojson ? "available" : "unavailable",
    incraGeojson: incraMatches.some((item) => item.geom_geojson) ? "available" : "unavailable",
    alertsGeojson: "unavailable",
    shapefileZip: "future",
  };
}

function safeErrorLog(error: unknown) {
  if (!error || typeof error !== "object") return { message: String(error).slice(0, 200) };
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message.slice(0, 200) : undefined,
    details: typeof record.details === "string" ? record.details.slice(0, 200) : undefined,
  };
}
