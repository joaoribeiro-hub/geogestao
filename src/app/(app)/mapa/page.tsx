import { GeoQueryWorkspace } from "@/components/geoquery/geoquery-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import type { MapFeature } from "@/components/map/property-map";

export default async function MapPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const [
    clientsResult,
    serviceCardsResult,
    propertiesResult,
    geometriesResult,
    searchesResult,
    sourcesResult,
  ] =
    await Promise.all([
      supabase.from("clients").select("*").eq("organization_id", organization.id).order("name"),
      supabase
        .from("service_cards")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("properties")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_geometries")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_searches")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("geo_data_sources")
        .select("*")
        .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const clients = clientsResult.data ?? [];
  const serviceCards = serviceCardsResult.data ?? [];
  const properties = propertiesResult.data ?? [];
  const geometries = geometriesResult.data ?? [];
  const searches = searchesResult.data ?? [];
  const sources = sourcesResult.data ?? [];
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const serviceMap = new Map(serviceCards.map((card) => [card.id, card]));
  const propertyMap = new Map(properties.map((property) => [property.id, property]));

  const features: MapFeature[] = [];
  geometries.forEach((geometry) => {
    const property = propertyMap.get(geometry.property_id);
    if (!property) return;
    const service = geometry.service_card_id
      ? serviceMap.get(geometry.service_card_id)
      : null;

    features.push({
      id: geometry.id,
      kind: "property",
      geojson: geometry.geojson,
      property: {
        name: property.name,
        area: property.area,
        registry_number: property.registry_number,
        registry_date: property.registry_date,
        car_state: property.car_state,
        car_federal: property.car_federal,
        city: property.city,
        state: property.state,
      },
      client: clientMap.get(geometry.client_id)
        ? { name: clientMap.get(geometry.client_id)!.name }
        : null,
      service: service
        ? {
            id: service.id,
            title: service.title,
            payment_status: service.payment_status,
          }
        : null,
    });
  });

  return (
    <div data-testid="map-page">
      <PageHeader
        title="Fazer busca de imóvel"
        titleTestId="map-title"
        description="Consulte CAR, INCRA, alertas e camadas territoriais a partir do numero do CAR Federal."
      />

      <GeoQueryWorkspace
        clients={clients}
        serviceCards={serviceCards}
        properties={properties}
        initialFeatures={features}
        searches={searches}
        sources={sources}
      />
    </div>
  );
}
