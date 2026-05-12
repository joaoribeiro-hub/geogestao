"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { Download, ExternalLink, Loader2, Search } from "lucide-react";
import { PropertyMapClient } from "@/components/map/property-map-client";
import { PropertyUploadForm } from "@/components/map/property-upload-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { officialGeoqueryLinks } from "@/lib/geoquery";
import { formatDate } from "@/lib/utils";
import type {
  CarProperty,
  Client,
  GeoDataSource,
  IncraProperty,
  Json,
  Property,
  PropertyDocument,
  PropertySearch,
  ServiceCard,
} from "@/types/database";
import type { MapFeature } from "@/components/map/property-map";

type GeoQueryResponse = {
  status: "found" | "not_found" | "partial" | "failed";
  codCar: string;
  summary: {
    message: string;
    carFound: boolean;
    incraMatches: number;
    alertsInside: number;
    alertsNearby: number;
    thematicLayers: number;
    bufferMeters: number;
  };
  car: CarProperty | null;
  incra: IncraProperty[];
  geojson: {
    car: Json | null;
    incra: Json[];
    alerts: Json[];
  };
  documents: PropertyDocument[];
  officialLinks: typeof officialGeoqueryLinks;
  searchId: string;
};

type GeoQueryErrorResponse = {
  error: string;
};

const tabs = [
  "Resumo",
  "CAR",
  "INCRA/SIGEF",
  "Alertas",
  "Tematicas",
  "Documentos",
  "Arquivos vetoriais",
] as const;

export function GeoQueryWorkspace({
  clients,
  serviceCards,
  properties,
  initialFeatures,
  searches,
  sources,
}: {
  clients: Client[];
  serviceCards: ServiceCard[];
  properties: Property[];
  initialFeatures: MapFeature[];
  searches: PropertySearch[];
  sources: GeoDataSource[];
}) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Resumo");
  const [result, setResult] = useState<GeoQueryResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resultFeatures = useMemo(() => buildResultFeatures(result), [result]);
  const mapFeatures = resultFeatures.length ? resultFeatures : initialFeatures;

  function searchProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      codCar: String(form.get("codCar") ?? ""),
      clientId: optionalValue(form.get("clientId")),
      serviceCardId: optionalValue(form.get("serviceCardId")),
      propertyId: optionalValue(form.get("propertyId")),
      bufferMeters: Number(form.get("bufferMeters") ?? 500),
    };

    startTransition(() => {
      void (async () => {
        setMessage(null);
        try {
          const response = await fetch("/api/geoquery/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = (await response.json().catch(() => null)) as
            | GeoQueryResponse
            | GeoQueryErrorResponse
            | null;

          if (!response.ok || !data || isGeoQueryError(data)) {
            setResult(null);
            setMessage(
              data && isGeoQueryError(data)
                ? data.error
                : "Nao foi possivel buscar o imovel.",
            );
            return;
          }

          setResult(data);
          setMessage(data.summary.message);
          setActiveTab("Resumo");
        } catch {
          setResult(null);
          setMessage("Nao foi possivel conectar ao servico de busca.");
        }
      })();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
      <aside className="grid content-start gap-6">
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Painel de busca</h2>
            <p className="text-sm text-muted-foreground">
              Digite o CAR Federal para consultar bases ja importadas no banco.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={searchProperty} data-testid="geoquery-search-form">
            <Field label="Numero do CAR Federal">
              <Input
                name="codCar"
                placeholder="UF-0000000-0000..."
                data-testid="geoquery-car-input"
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <Field label="Cliente opcional">
                <select
                  name="clientId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  data-testid="geoquery-client-select"
                >
                  <option value="">Nao vincular</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Servico/card tecnico opcional">
                <select
                  name="serviceCardId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  data-testid="geoquery-service-select"
                >
                  <option value="">Nao vincular</option>
                  {serviceCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Imovel ja cadastrado opcional">
              <select
                name="propertyId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="geoquery-property-select"
              >
                <option value="">Nao vincular</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Buffer de alertas proximos (m)">
              <Input
                name="bufferMeters"
                type="number"
                min={0}
                max={10000}
                defaultValue={500}
                data-testid="geoquery-buffer-input"
              />
            </Field>

            <Button disabled={pending} data-testid="geoquery-submit">
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
              Buscar imovel
            </Button>
          </form>

          {message ? (
            <p className="mt-4 rounded-md bg-secondary p-3 text-sm" data-testid="geoquery-message">
              {message}
            </p>
          ) : null}

          <div className="mt-4 grid gap-2">
            <OfficialLink href={officialGeoqueryLinks.carConsultaPublica}>
              Abrir consulta publica do CAR
            </OfficialLink>
            <OfficialLink href={officialGeoqueryLinks.carCentralAcesso}>
              Acessar Central do CAR / gov.br
            </OfficialLink>
            <OfficialLink href={officialGeoqueryLinks.meuImovelRural}>
              Meu Imovel Rural
            </OfficialLink>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Bases geograficas</h2>
          {sources.length ? (
            <div className="space-y-3">
              {sources.map((source) => (
                <div key={source.id} className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">{source.name}</p>
                  <p className="text-muted-foreground">
                    {source.provider ?? "-"} · {source.source_type} · {source.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Importada em {formatDate(source.imported_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma base geografica importada ainda." />
          )}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Historico</h2>
          {searches.length ? (
            <div className="space-y-3">
              {searches.map((search) => (
                <div key={search.id} className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">{search.cod_car}</p>
                  <p className="text-muted-foreground">
                    {search.status} · {formatDate(search.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma busca registrada." />
          )}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Cadastro manual de perimetro</h2>
          {clients.length ? (
            <PropertyUploadForm clients={clients} serviceCards={serviceCards} />
          ) : (
            <EmptyState title="Cadastre um cliente antes de enviar KML/KMZ." />
          )}
        </section>
      </aside>

      <section className="grid content-start gap-6">
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Resultado da busca</h2>
              <p className="text-sm text-muted-foreground">
                Dados CAR, INCRA/SIGEF, alertas, tematicas e documentos.
              </p>
            </div>
            {result ? (
              <Button variant="outline" type="button" onClick={() => window.print()}>
                Gerar relatorio da busca
              </Button>
            ) : null}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  activeTab === tab ? "border-primary text-primary" : "text-muted-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <ResultTab activeTab={activeTab} result={result} />
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Mapa</h2>
              <p className="text-sm text-muted-foreground">
                OpenStreetMap com perimetro CAR, INCRA e alertas quando houver GeoJSON.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Legend color="bg-green-500" label="CAR/KML" />
              <Legend color="bg-blue-500" label="INCRA" />
              <Legend color="bg-red-500" label="Alertas" />
              <Legend color="bg-violet-500" label="Tematicas" />
            </div>
          </div>
          {mapFeatures.length ? (
            <PropertyMapClient features={mapFeatures} />
          ) : (
            <div className="flex h-[620px] min-h-[420px] items-center justify-center rounded-lg border bg-secondary">
              <EmptyState title="Busque um CAR importado ou envie um KML/KMZ para exibir o perimetro." />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ResultTab({
  activeTab,
  result,
}: {
  activeTab: (typeof tabs)[number];
  result: GeoQueryResponse | null;
}) {
  if (!result) {
    return (
      <EmptyState title="Nenhuma busca executada. Informe o CAR Federal para consultar as bases importadas." />
    );
  }

  if (activeTab === "Resumo") {
    return (
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <Info label="Status" value={result.status} />
        <Info label="CAR" value={result.codCar} />
        <Info label="Mensagem" value={result.summary.message} />
        <Info label="INCRA/SIGEF" value={`${result.summary.incraMatches} correspondencias`} />
        <Info label="Alertas sobrepostos" value={`${result.summary.alertsInside}`} />
        <Info label="Alertas proximos" value={`${result.summary.alertsNearby}`} />
      </div>
    );
  }

  if (activeTab === "CAR") {
    return result.car ? (
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <Info label="Codigo CAR" value={result.car.cod_car} />
        <Info label="Municipio/UF" value={[result.car.municipio, result.car.uf].filter(Boolean).join("/") || "-"} />
        <Info label="Area ha" value={result.car.area_ha?.toString() ?? "-"} />
        <Info label="Status" value={result.car.status_car ?? "-"} />
        <Info label="Inscricao" value={formatDate(result.car.data_inscricao)} />
        <Info label="Atualizacao" value={formatDate(result.car.data_atualizacao)} />
      </div>
    ) : (
      <EmptyState title={result.summary.message} />
    );
  }

  if (activeTab === "INCRA/SIGEF") {
    return result.incra.length ? (
      <div className="space-y-3">
        {result.incra.map((item) => (
          <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
            <p className="font-medium">{item.sigef_code ?? item.cnir ?? item.codigo_imovel ?? "INCRA/SIGEF"}</p>
            <p className="text-muted-foreground">
              {item.situacao ?? "-"} · {item.area_ha ?? "-"} ha · {[item.municipio, item.uf].filter(Boolean).join("/") || "-"}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState title="Nenhuma correspondencia INCRA/SIGEF encontrada." />
    );
  }

  if (activeTab === "Alertas") {
    return (
      <EmptyState title="Alertas espaciais preparados para importacao. A consulta por intersecao/buffer sera ativada apos importar camadas com PostGIS." />
    );
  }

  if (activeTab === "Tematicas") {
    return (
      <EmptyState title="Camadas tematicas preparadas para importacao. Estados, municipios, biomas, UCs, terras indigenas e outras camadas entram pela rotina de bases geograficas." />
    );
  }

  if (activeTab === "Documentos") {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-md bg-secondary p-3">
          Por seguranca, o GeoGestao nao armazena login gov.br. Acesse a Central do CAR
          com a conta autorizada, baixe o documento atualizado e anexe em Anexos.
        </p>
        {result.documents.length ? (
          result.documents.map((document) => (
            <div key={document.id} className="rounded-md border bg-background p-3">
              <p className="font-medium">{document.title}</p>
              <p className="text-muted-foreground">{document.document_type}</p>
            </div>
          ))
        ) : (
          <EmptyState title="Nenhum documento anexado para este CAR." />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <DownloadButton label="Baixar GeoJSON do CAR" geojson={result.geojson.car} />
      <DownloadButton
        label="Baixar GeoJSON do INCRA"
        geojson={result.geojson.incra.length ? { type: "FeatureCollection", features: result.geojson.incra } : null}
      />
      <Button type="button" variant="outline" disabled>
        Shapefile ZIP em fase futura
      </Button>
    </div>
  );
}

function buildResultFeatures(result: GeoQueryResponse | null): MapFeature[] {
  if (!result) return [];
  const features: MapFeature[] = [];
  if (result.car?.geom_geojson) {
    features.push({
      id: `car-${result.car.id}`,
      kind: "car",
      title: `CAR ${result.car.cod_car}`,
      layerLabel: "CAR",
      description: result.summary.message,
      geojson: result.car.geom_geojson,
      property: {
        name: `CAR ${result.car.cod_car}`,
        area: result.car.area_ha,
        registry_number: null,
        registry_date: null,
        car_state: null,
        car_federal: result.car.cod_car,
        city: result.car.municipio,
        state: result.car.uf,
      },
      client: null,
      service: null,
    });
  }

  result.incra.forEach((item) => {
    if (!item.geom_geojson) return;
    features.push({
      id: `incra-${item.id}`,
      kind: "incra",
      title: item.sigef_code ?? item.cnir ?? item.codigo_imovel ?? "INCRA/SIGEF",
      layerLabel: "INCRA/SIGEF",
      description: item.situacao,
      geojson: item.geom_geojson,
      property: {
        name: item.sigef_code ?? item.cnir ?? item.codigo_imovel ?? "INCRA/SIGEF",
        area: item.area_ha,
        registry_number: item.codigo_imovel,
        registry_date: item.data_certificacao,
        car_state: null,
        car_federal: result.codCar,
        city: item.municipio,
        state: item.uf,
      },
      client: null,
      service: null,
    });
  });

  return features;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function OfficialLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-secondary"
    >
      <ExternalLink className="size-4" aria-hidden="true" />
      {children}
    </a>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value || "-"}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function DownloadButton({ label, geojson }: { label: string; geojson: Json | null }) {
  function download() {
    if (!geojson) return;
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label.toLowerCase().replace(/\s+/g, "-")}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" onClick={download} disabled={!geojson}>
      <Download aria-hidden="true" />
      {label}
    </Button>
  );
}

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim();
  return normalized ? normalized : null;
}

function isGeoQueryError(
  value: GeoQueryResponse | GeoQueryErrorResponse,
): value is GeoQueryErrorResponse {
  return "error" in value;
}
