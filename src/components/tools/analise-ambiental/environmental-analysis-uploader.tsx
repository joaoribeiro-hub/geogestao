"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Play, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type EnvironmentalJob = {
  id: string;
  status: string;
  original_filename: string | null;
  created_at: string;
  input_size_bytes?: number | null;
  requested_layers?: string[] | null;
  area_ha?: number | string | null;
  bbox?: unknown;
  result_summary?: Record<string, unknown> | null;
  warnings?: unknown[] | null;
  output_storage_paths?: Record<string, string> | null;
  error_message?: string | null;
  finished_at?: string | null;
  progress?: number | null;
  input_raster_storage_path?: string | null;
};

type SignedOutput = {
  key: string;
  path: string;
  layer_key?: string | null;
  layer_name?: string | null;
  output_format?: string | null;
  file_name?: string | null;
  area_ha?: number | string | null;
  length_m?: number | string | null;
  confidence?: string | null;
  provider?: string | null;
  official_data?: boolean | null;
  signedUrl?: string | null;
  error?: string | null;
};

const SUPPORTED_LAYER_OPTIONS = [
  ["vegetacao_nativa", "Vegetação nativa"],
  ["agropecuaria", "Agropecuária"],
  ["agua", "Água"],
] as const;

const COMING_SOON_LAYER_OPTIONS = [
  ["floresta", "Floresta"],
  ["formacao_savanica", "Formação savânica"],
  ["vegetacao_campestre", "Vegetação campestre"],
  ["area_nao_vegetada", "Área não vegetada"],
  ["drenagem", "Drenagem"],
] as const;

type HidroProviderStatus = {
  configured: boolean;
  source: string;
  version: string;
};

export function EnvironmentalAnalysisUploader({
  initialJobs,
  hidroProvider,
}: {
  initialJobs: EnvironmentalJob[];
  hidroProvider: HidroProviderStatus;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [layers, setLayers] = useState(["vegetacao_nativa", "agropecuaria", "agua"]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [outputsByJob, setOutputsByJob] = useState<Record<string, SignedOutput[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rasterRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Selecione um arquivo KML, KMZ ou ZIP.");
      const formData = new FormData();
      formData.set("file", file);
      const rasterFile = rasterRef.current?.files?.[0];
      if (rasterFile) formData.set("rasterFile", rasterFile);
      layers.forEach((layer) => formData.append("layers", layer));

      const response = await fetch("/api/tools/analise-ambiental/jobs", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { job?: EnvironmentalJob; error?: string; worker?: { message?: string } };
      if (!response.ok || !data.job) throw new Error(data.error || "Não foi possível criar o job ambiental.");
      setJobs((current) => [data.job!, ...current]);
      if (fileRef.current) fileRef.current.value = "";
      if (rasterRef.current) rasterRef.current.value = "";
      setMessage(data.worker?.message || "Job criado. O processamento real depende do worker Python ambiental.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao criar job ambiental.");
    } finally {
      setLoading(false);
    }
  }

  function toggleLayer(layer: string) {
    setLayers((current) =>
      current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer],
    );
  }

  async function refreshJobs() {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tools/analise-ambiental/jobs");
      const data = (await response.json()) as { jobs?: EnvironmentalJob[]; error?: string };
      if (!response.ok || !data.jobs) throw new Error(data.error || "Não foi possível atualizar o histórico.");
      setJobs(data.jobs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao atualizar jobs.");
    } finally {
      setRefreshing(false);
    }
  }

  async function processJob(jobId: string) {
    setProcessingJobId(jobId);
    setMessage(null);
    try {
      const response = await fetch(`/api/tools/analise-ambiental/jobs/${jobId}/process`, { method: "POST" });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível acionar o worker.");
      setMessage(data.message || "Job enviado ao worker ambiental.");
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao acionar worker.");
    } finally {
      setProcessingJobId(null);
    }
  }

  async function loadOutputs(jobId: string) {
    setMessage(null);
    try {
      const response = await fetch(`/api/tools/analise-ambiental/jobs/${jobId}/outputs`);
      const data = (await response.json()) as { outputs?: SignedOutput[]; error?: string };
      if (!response.ok || !data.outputs) throw new Error(data.error || "Não foi possível gerar URLs assinadas.");
      setOutputsByJob((current) => ({ ...current, [jobId]: data.outputs ?? [] }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar outputs.");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Novo job ambiental</CardTitle>
          <CardDescription>
            Envie o limite da propriedade. O worker busca a classificação MapBiomas/GEE automaticamente quando configurado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Arquivo KML/KMZ/ZIP</span>
              <Input ref={fileRef} type="file" accept=".kml,.kmz,.zip" />
            </label>
            <details className="rounded-md border bg-secondary/40 p-3 text-sm">
              <summary className="cursor-pointer font-medium">Modo avançado: usar GeoTIFF próprio</summary>
              <label className="mt-3 block space-y-1">
                <span>GeoTIFF MapBiomas recortado</span>
                <Input ref={rasterRef} type="file" accept=".tif,.tiff,.geotiff" />
                <span className="block text-xs text-muted-foreground">
                  Uso técnico/developer. O fluxo principal deve funcionar só com KML quando o provider MapBiomas/GEE estiver configurado no worker.
                </span>
              </label>
            </details>
            <div className="space-y-2">
              <p className="text-sm font-medium">Camadas solicitadas</p>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_LAYER_OPTIONS.map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={layers.includes(value) ? "default" : "outline"}
                    onClick={() => toggleLayer(value)}
                  >
                    {label}
                  </Button>
                ))}
                {COMING_SOON_LAYER_OPTIONS.map(([value, label]) => (
                  <Button key={value} type="button" size="sm" variant="outline" disabled title="Provider ainda não implementado no worker">
                    {label} · em breve
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={layers.includes("hidrografia_oficial") ? "default" : "outline"}
                  disabled={!hidroProvider.configured}
                  title={
                    hidroProvider.configured
                      ? `${hidroProvider.source} ${hidroProvider.version}`
                      : "Requer base ANA/BHO6 no worker"
                  }
                  onClick={() => toggleLayer("hidrografia_oficial")}
                >
                  Hidrografia oficial{hidroProvider.configured ? "" : " · requer base ANA/BHO6 no worker"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Água é raster MapBiomas. Hidrografia oficial é vetor ANA/BHO6 e só fica disponível quando a base estiver configurada no worker.
              </p>
            </div>
            {message ? <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">{message}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              Enviar KML e processar com MapBiomas
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Histórico da organização</CardTitle>
              <CardDescription>Jobs criados pelos membros da empresa atual.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refreshJobs} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length ? (
            jobs.map((job) => (
              <div key={job.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{job.original_filename || "Arquivo ambiental"}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.status} · {new Date(job.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    {Math.max(0, Math.min(100, Number(job.progress ?? 0)))}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Área: {formatArea(job.area_ha)} · Camadas:{" "}
                  {(job.requested_layers ?? []).join(", ") || "vegetacao, agua, drenagem"}
                </p>
                <ProviderNotice job={job} outputs={outputsByJob[job.id] ?? []} />
                {isLimitOnly(job, outputsByJob[job.id] ?? []) ? (
                  <p className="mt-2 rounded-md bg-amber-100 p-2 text-xs text-amber-900">
                    Limite extraído. A análise ambiental completa ainda depende das camadas ambientais.
                  </p>
                ) : null}
                {job.error_message ? <p className="mt-2 text-xs text-destructive">{job.error_message}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => processJob(job.id)}
                    disabled={processingJobId === job.id}
                  >
                    {processingJobId === job.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                    Processar agora
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => loadOutputs(job.id)}>
                    <Download aria-hidden="true" />
                    Outputs
                  </Button>
                </div>
                {outputsByJob[job.id]?.length ? (
                  <LayerOutputs outputs={outputsByJob[job.id]} areaHa={job.area_ha} />
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
              Nenhum job ambiental criado ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LayerOutputs({ outputs, areaHa }: { outputs: SignedOutput[]; areaHa?: EnvironmentalJob["area_ha"] }) {
  const packageOutput = outputs.find((output) => output.layer_key === "pacote");
  const layerGroups = groupOutputsByLayer(outputs.filter((output) => !["pacote", "relatorio"].includes(output.layer_key ?? "")));

  return (
    <div className="mt-3 space-y-3">
      {layerGroups.map((group) => (
        <div key={group.layerKey} className="rounded-md bg-secondary p-3 text-xs">
          <div className="grid gap-3 md:grid-cols-[minmax(180px,1.2fr)_minmax(120px,0.8fr)_minmax(90px,0.5fr)_auto] md:items-center">
            <div>
              <p className="flex items-center gap-2 font-medium text-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layerColor(group.layerKey) }} />
                {group.layerName}
              </p>
              <p className="text-muted-foreground">
                Fonte: {formatProvider(group.provider, group.officialData)}
              </p>
            </div>
            <span>{formatLayerArea(group.outputs)}</span>
            <span>{formatLayerPercent(group.outputs, areaHa) || "Percentual pendente"}</span>
            <div className="flex flex-wrap gap-2">
              {["kml", "geojson", "shp_zip"].map((format) => (
                <OutputLink key={format} output={group.outputs.find((item) => item.output_format === format)} label={formatLabel(format)} />
              ))}
            </div>
          </div>
        </div>
      ))}
      {packageOutput ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Pacote completo</span>
            <OutputLink output={packageOutput} label="Baixar pacote completo" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OutputLink({ output, label }: { output?: SignedOutput; label: string }) {
  if (!output) {
    return <span className="rounded-md border px-2 py-1 text-muted-foreground">{label}: pendente</span>;
  }
  if (!output.signedUrl) {
    return <span className="rounded-md border px-2 py-1 text-muted-foreground">{output.error || "Indisponível"}</span>;
  }
  return (
    <a className="rounded-md border bg-background px-2 py-1 font-medium text-primary hover:underline" href={output.signedUrl} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function formatArea(area: EnvironmentalJob["area_ha"]) {
  const numericArea = Number(area ?? 0);
  if (!Number.isFinite(numericArea) || numericArea <= 0) return "pendente";
  return `${numericArea.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`;
}

function formatOutputName(key: string) {
  const labels: Record<string, string> = {
    limite_geojson: "Limite GeoJSON",
    limite_kml: "Limite KML",
    relatorio_json: "Relatório JSON",
    vegetacao_geojson: "Vegetação GeoJSON",
    agua_geojson: "Água GeoJSON",
    hidrografia_oficial: "Hidrografia oficial",
  };
  return labels[key] || key;
}

function groupOutputsByLayer(outputs: SignedOutput[]) {
  const groups = new Map<string, SignedOutput[]>();
  for (const output of outputs) {
    const layerKey = output.layer_key || "outros";
    groups.set(layerKey, [...(groups.get(layerKey) ?? []), output]);
  }
  return Array.from(groups.entries()).map(([layerKey, layerOutputs]) => ({
    layerKey,
    layerName: layerOutputs[0]?.layer_name || formatOutputName(layerKey),
    provider: layerOutputs.find((output) => output.provider)?.provider,
    officialData: layerOutputs.some((output) => output.official_data),
    confidence: layerOutputs.find((output) => output.confidence)?.confidence,
    outputs: layerOutputs,
  }));
}

function formatLabel(format: string) {
  if (format === "shp_zip") return "Baixar SHP";
  if (format === "geojson") return "Baixar GeoJSON";
  if (format === "kml") return "Baixar KML";
  return "Baixar";
}

function isLimitOnly(job: EnvironmentalJob, outputs: SignedOutput[]) {
  if (!outputs.length) return false;
  const layerKeys = new Set(outputs.map((output) => output.layer_key).filter(Boolean));
  const environmentalLayerKeys = [
    "vegetacao_existente",
    "vegetacao_nativa",
    "floresta",
    "agropecuaria",
    "agua_represa",
    "agua",
    "area_nao_vegetada",
    "drenagem_corrego",
    "hidrografia_oficial",
  ];
  return job.status === "concluido" && layerKeys.has("limite") && !environmentalLayerKeys.some((key) => layerKeys.has(key));
}

function ProviderNotice({ job, outputs }: { job: EnvironmentalJob; outputs: SignedOutput[] }) {
  const summary = job.result_summary ?? {};
  const provider = String(summary.provider || outputs.find((output) => output.provider)?.provider || "");
  const simulated = provider === "dev_fixture" || job.status === "simulado" || summary.official_data === false;
  const realProviders = ["mapbiomas_gee", "mapbiomas_manual_raster", "mapbiomas_public_raster", "mapbiomas_real", "ana_hidrografia_oficial", "multi_provider"];
  const real = realProviders.includes(provider) || outputs.some((output) => realProviders.includes(output.provider || ""));

  if (simulated) {
    return (
      <p className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-100 p-2 text-xs text-amber-950">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Resultado simulado para teste. Não usar como análise ambiental real.
      </p>
    );
  }

  if (real) {
    const method =
      provider === "ana_hidrografia_oficial"
        ? "vetorial oficial"
        : provider === "multi_provider"
          ? "por fontes oficiais configuradas"
          : "por raster/classificação";
    return <p className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">Resultado {formatProvider(provider, true)} {method}.</p>;
  }

  return null;
}

function formatProvider(provider?: string | null, officialData?: boolean | null) {
  if (provider === "mapbiomas_gee") return "MapBiomas/GEE real";
  if (provider === "mapbiomas_manual_raster") return "MapBiomas GeoTIFF manual";
  if (provider === "mapbiomas_public_raster") return "MapBiomas raster público";
  if (provider === "mapbiomas_real") return officialData ? "Real MapBiomas" : "MapBiomas";
  if (provider === "ana_hidrografia_oficial") return "ANA/SNIRH BHO 6";
  if (provider === "multi_provider") return "fontes oficiais";
  if (provider === "dev_fixture") return "Simulado";
  return provider || "pendente";
}

function formatLayerArea(outputs: SignedOutput[]) {
  const withArea = outputs.find((output) => Number(output.area_ha ?? 0) > 0);
  const withLength = outputs.find((output) => Number(output.length_m ?? 0) > 0);
  if (withLength && !withArea) {
    return `Extensão: ${Number(withLength.length_m).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m`;
  }
  return withArea ? `Área: ${formatArea(withArea.area_ha)}` : "Área pendente";
}

function formatLayerPercent(outputs: SignedOutput[], totalArea?: EnvironmentalJob["area_ha"]) {
  const withArea = outputs.find((output) => Number(output.area_ha ?? 0) > 0);
  return withArea ? formatPercent(withArea.area_ha, totalArea) : "";
}

function formatPercent(area: EnvironmentalJob["area_ha"], totalArea: EnvironmentalJob["area_ha"] | undefined) {
  const areaNumber = Number(area ?? 0);
  const totalNumber = Number(totalArea ?? 0);
  if (!Number.isFinite(areaNumber) || !Number.isFinite(totalNumber) || totalNumber <= 0) return "";
  return `${((areaNumber / totalNumber) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function layerColor(layerKey: string) {
  const colors: Record<string, string> = {
    floresta: "#1f8d49",
    vegetacao_nativa: "#2ca25f",
    agropecuaria: "#f1c232",
    agua: "#2532e4",
    agua_represa: "#2532e4",
    area_nao_vegetada: "#d7191c",
    vegetacao_existente: "#7c3aed",
    drenagem_corrego: "#2563eb",
    hidrografia_oficial: "#2563eb",
    limite: "#111827",
  };
  return colors[layerKey] || "#64748b";
}
