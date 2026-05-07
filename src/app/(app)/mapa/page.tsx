import { PropertyUploadForm } from "@/components/map/property-upload-form";
import { PropertyMapClient } from "@/components/map/property-map-client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createServerSupabase } from "@/lib/supabase/server";
import type { MapFeature } from "@/components/map/property-map";

export default async function MapPage() {
  const supabase = await createServerSupabase();
  const [clientsResult, serviceCardsResult, propertiesResult, geometriesResult] =
    await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("service_cards").select("*").order("created_at", { ascending: false }),
      supabase.from("properties").select("*").order("created_at", { ascending: false }),
      supabase.from("property_geometries").select("*").order("created_at", { ascending: false }),
    ]);

  const clients = clientsResult.data ?? [];
  const serviceCards = serviceCardsResult.data ?? [];
  const properties = propertiesResult.data ?? [];
  const geometries = geometriesResult.data ?? [];
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
        title="Mapa"
        description="Perimetros KML/KMZ vinculados a clientes, imoveis e servicos tecnicos."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Novo perimetro</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length ? (
              <PropertyUploadForm clients={clients} serviceCards={serviceCards} />
            ) : (
              <EmptyState title="Cadastre um cliente antes de enviar KML/KMZ." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projetos no mapa</CardTitle>
          </CardHeader>
          <CardContent>
            {features.length ? (
              <PropertyMapClient features={features} />
            ) : (
              <div className="flex h-[620px] min-h-[420px] items-center justify-center rounded-lg border bg-secondary">
                <EmptyState title="Envie um KML/KMZ para exibir o primeiro perimetro." />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
