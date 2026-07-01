import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function MeuImovelCarModulePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  const [carResults, propertyResults, history] = await Promise.all([
    query ? searchCarProperties(supabase, organization.id, query) : Promise.resolve([]),
    query ? searchProperties(supabase, organization.id, query) : Promise.resolve([]),
    loadHistory(supabase, organization.id),
  ]);

  return (
    <div>
      <PageHeader
        title="MeuIMOVEL-CAR"
        description="Consulta de imóvel rural, CAR, SIGEF/INCRA e alertas."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Buscar imóvel ou CAR</CardTitle>
              <CardDescription>
                Reaproveita as bases GeoQuery já importadas no Supabase e os imóveis da organização atual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3 sm:flex-row">
                <Input
                  name="q"
                  defaultValue={query}
                  placeholder="CAR, nome do imóvel, proprietário ou município..."
                />
                <Button type="submit">
                  <Search aria-hidden="true" />
                  Buscar
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                Nova análise por perímetro continua preparada para uma próxima etapa; quando não houver geometria, o módulo informa sem inventar mapa.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>
                {query ? `${carResults.length + propertyResults.length} resultado(s) para "${query}".` : "Digite um termo para pesquisar."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {query && !carResults.length && !propertyResults.length ? (
                <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  Nenhum registro encontrado nas bases importadas ou nos imóveis da empresa.
                </p>
              ) : null}

              {carResults.map((item) => (
                <ResultCard
                  key={`car-${item.id}`}
                  title={`CAR ${item.cod_car}`}
                  subtitle="Base pública/global ou base da organização"
                  rows={[
                    ["CAR", item.cod_car ?? "-"],
                    ["Município/UF", [item.municipio, item.uf].filter(Boolean).join("/") || "-"],
                    ["Área", item.area_ha ? `${item.area_ha} ha` : "-"],
                    ["Geometria", item.geom_geojson ? "Disponível" : "Sem geometria disponível para este registro"],
                  ]}
                />
              ))}

              {propertyResults.map((item) => (
                <ResultCard
                  key={`property-${item.id}`}
                  title={item.name}
                  subtitle="Imóvel salvo na organização atual"
                  rows={[
                    ["CAR Federal", item.car_federal ?? "-"],
                    ["Município/UF", [item.city, item.state].filter(Boolean).join("/") || "-"],
                    ["Área", item.area ? `${item.area} ha` : "-"],
                    ["Detalhe", item.service_card_id ? `Vinculado ao serviço ${item.service_card_id}` : "Sem serviço vinculado"],
                  ]}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico da empresa</CardTitle>
            <CardDescription>Últimas consultas GeoQuery registradas para esta organização.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">{item.cod_car}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {item.status} · {new Date(item.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                Nenhuma análise registrada ainda.
              </p>
            )}
            <Button type="button" variant="outline" asChild>
              <Link href="/mapa">Abrir consulta GeoQuery completa</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function searchCarProperties(supabase: Supabase, organizationId: string, query: string) {
  const safe = sanitizeQuery(query);
  const { data, error } = await supabase
    .from("car_properties")
    .select("id,organization_id,cod_car,municipio,uf,area_ha,geom_geojson")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .or(`cod_car.ilike.%${safe}%,municipio.ilike.%${safe}%,uf.ilike.%${safe}%`)
    .limit(20);
  if (error) return [];
  return data ?? [];
}

async function searchProperties(supabase: Supabase, organizationId: string, query: string) {
  const safe = sanitizeQuery(query);
  const { data, error } = await supabase
    .from("properties")
    .select("id,name,car_federal,city,state,area,service_card_id")
    .eq("organization_id", organizationId)
    .or(`name.ilike.%${safe}%,car_federal.ilike.%${safe}%,city.ilike.%${safe}%,state.ilike.%${safe}%`)
    .limit(20);
  if (error) return [];
  return data ?? [];
}

async function loadHistory(supabase: Supabase, organizationId: string) {
  const { data, error } = await supabase
    .from("property_searches")
    .select("id,cod_car,status,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return data ?? [];
}

function sanitizeQuery(value: string) {
  return value.replace(/[,%()]/g, " ").trim().slice(0, 80);
}

function ResultCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md bg-secondary px-3 py-2">
            <span className="block text-xs text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
