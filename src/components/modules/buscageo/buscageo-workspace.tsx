"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Download,
  FileArchive,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Map,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import type { BuscaGeoJobResponse } from "@/lib/modules/buscageo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const allowedExtensions = [".kml", ".kmz", ".zip"];
const activeStatuses = new Set(["reading_geometry", "searching_scenes", "processing"]);

export function BuscaGeoWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<BuscaGeoJobResponse | null>(null);
  const [history, setHistory] = useState<BuscaGeoJobResponse[]>([]);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cloudCover, setCloudCover] = useState("30");
  const [bboxFactor, setBboxFactor] = useState("1.5");
  const pollingRef = useRef<number | null>(null);

  const acceptedText = useMemo(() => allowedExtensions.join(", "), []);
  const progress = job?.progress ?? 0;
  const isBusy = Boolean(loadingAction) || Boolean(job && activeStatuses.has(job.status));
  const canReadGeometry = Boolean(job?.jobId && job.inputStoragePath && !isBusy);
  const canSearchScenes = Boolean(job?.jobId && job.inputStoragePath && !isBusy);
  const canProcess = Boolean(job?.jobId && selectedSceneIds.length >= 1 && selectedSceneIds.length <= 2 && !isBusy);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/modules/buscageo/jobs", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json().catch(() => null)) as { jobs?: BuscaGeoJobResponse[] } | null;
    setHistory(Array.isArray(data?.jobs) ? data.jobs : []);
  }, []);

  const refreshJob = useCallback(
    async (jobId: string) => {
      const response = await fetch(`/api/modules/buscageo/jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok) {
        stopPolling();
        return;
      }
      const data = (await response.json()) as BuscaGeoJobResponse;
      setJob(data);
      setSelectedSceneIds((current) => (current.length ? current : data.selectedSceneIds));
      if (!activeStatuses.has(data.status)) {
        stopPolling();
        void loadHistory();
      }
    },
    [loadHistory, stopPolling],
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!job?.jobId || !activeStatuses.has(job.status) || pollingRef.current) return;
    const jobId = job.jobId;
    pollingRef.current = window.setInterval(() => {
      void refreshJob(jobId);
    }, 2000);
    return () => stopPolling();
  }, [job?.jobId, job?.status, refreshJob, stopPolling]);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    setNotice(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    const lower = nextFile.name.toLowerCase();
    const valid = allowedExtensions.some((extension) => lower.endsWith(extension));
    if (!valid) {
      event.target.value = "";
      setFile(null);
      setError("Envie um arquivo KML, KMZ ou ZIP de Shapefile.");
      return;
    }
    setFile(nextFile);
  }

  async function createJob() {
    if (!file) {
      setError("Selecione um arquivo de perimetro.");
      return;
    }
    setLoadingAction("upload");
    setError(null);
    setNotice(null);
    setSelectedSceneIds([]);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    formData.append("cloudCover", cloudCover);
    formData.append("bboxFactor", bboxFactor);
    formData.append("composition", "visual");

    const response = await fetch("/api/modules/buscageo/jobs", { method: "POST", body: formData });
    const data = (await response.json().catch(() => null)) as BuscaGeoJobResponse & { error?: string };
    setLoadingAction(null);
    if (!response.ok) {
      setError(data?.error ?? "Nao foi possivel criar o job BuscaGEO.");
      return;
    }
    setJob(data);
    setNotice("Arquivo salvo. Agora leia a area ou busque as cenas CBERS.");
    void loadHistory();
  }

  async function runAction(action: "read-geometry" | "search-scenes" | "process" | "cancel") {
    if (!job) return;
    setLoadingAction(action);
    setError(null);
    setNotice(null);
    const init: RequestInit = { method: "POST" };
    if (action === "process") {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify({ selectedSceneIds });
    }
    const response = await fetch(`/api/modules/buscageo/jobs/${job.jobId}/${action}`, init);
    const data = (await response.json().catch(() => null)) as BuscaGeoJobResponse & { error?: string };
    setLoadingAction(null);
    if (!response.ok) {
      setError(data?.error ?? "Nao foi possivel executar a etapa.");
      return;
    }
    setJob(data);
    if (data.status === "worker_pending") {
      setNotice(data.message);
    }
    void loadHistory();
  }

  function toggleScene(imageId: string) {
    setError(null);
    setNotice(null);
    if (selectedSceneIds.includes(imageId)) {
      setSelectedSceneIds((current) => current.filter((id) => id !== imageId));
      return;
    }
    if (selectedSceneIds.length >= 2) {
      setNotice("Selecione no maximo 2 cenas.");
      return;
    }
    setSelectedSceneIds((current) => [...current, imageId]);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Modulo geoespacial</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">BuscaGEO</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Envie KML, KMZ ou Shapefile ZIP, leia a area, busque cenas CBERS/INPE,
              selecione uma ou duas imagens e gere o GeoTIFF final.
            </p>
          </div>
          {job?.downloadUrl ? (
            <Button asChild>
              <a href={job.downloadUrl}>
                <Download aria-hidden="true" />
                Baixar GeoTIFF final
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      {error ? <StatusBanner tone="error" icon={<AlertCircle aria-hidden="true" />} text={error} /> : null}
      {notice ? <StatusBanner tone="notice" icon={<AlertCircle aria-hidden="true" />} text={notice} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(330px,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>1. Upload do perimetro</CardTitle>
              <CardDescription>
                O arquivo fica no bucket privado em `organizations/organization_id/modules/buscageo/...`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="buscageo-file">Arquivo KML, KMZ ou Shapefile ZIP</Label>
                <Input id="buscageo-file" type="file" accept={acceptedText} onChange={onFileChange} disabled={isBusy} />
                {file ? (
                  <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
                    <FileArchive className="size-4 text-primary" aria-hidden="true" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ) : null}
              </div>
              <Button className="w-full" onClick={createJob} disabled={!file || isBusy}>
                {loadingAction === "upload" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                Salvar arquivo no BuscaGEO
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Parametros CBERS</CardTitle>
              <CardDescription>Usados pelo worker na busca STAC e no recorte das cenas.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Data inicial" type="date" value={startDate} onChange={setStartDate} />
              <Field label="Data final" type="date" value={endDate} onChange={setEndDate} />
              <Field label="Nuvens max. (%)" value={cloudCover} onChange={setCloudCover} />
              <Field label="Expansao da area" value={bboxFactor} onChange={setBboxFactor} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Area e cenas</CardTitle>
              <CardDescription>{job?.message ?? "Aguardando upload."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar value={progress} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => runAction("read-geometry")} disabled={!canReadGeometry}>
                  {loadingAction === "read-geometry" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Map aria-hidden="true" />}
                  Ler area
                </Button>
                <Button onClick={() => runAction("search-scenes")} disabled={!canSearchScenes}>
                  {loadingAction === "search-scenes" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
                  Buscar imagens
                </Button>
              </div>
              <AreaPreview job={job} />
              {job?.status === "worker_pending" ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Configure `BUSCAGEO_WORKER_URL` e `BUSCAGEO_WORKER_SECRET` para ativar leitura, cenas e mosaico.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="size-5" aria-hidden="true" />
                    Cenas CBERS
                  </CardTitle>
                  <CardDescription>Selecione 1 ou 2 previews para gerar o mosaico final.</CardDescription>
                </div>
                <Button onClick={() => runAction("process")} disabled={!canProcess}>
                  {loadingAction === "process" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Layers3 aria-hidden="true" />}
                  Gerar GeoTIFF
                  <span className="sr-only">Gerar mosaico BuscaGEO</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {job?.scenes.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {job.scenes.map((scene) => {
                    const selected = selectedSceneIds.includes(scene.imageId);
                    return (
                      <button
                        key={scene.imageId}
                        type="button"
                        onClick={() => toggleScene(scene.imageId)}
                        className={`overflow-hidden rounded-lg border bg-background text-left shadow-sm transition ${
                          selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/60"
                        }`}
                      >
                        <div className="aspect-[4/3] bg-secondary">
                          {scene.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={scene.previewUrl} alt={`Preview CBERS ${scene.imageDate ?? ""}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{scene.imageDate?.slice(0, 10) || scene.stacId || "Cena CBERS"}</span>
                            {selected ? <CheckCircle2 className="size-5 text-primary" aria-hidden="true" /> : <span className="size-5 rounded-full border" />}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{scene.assetName ?? "asset"} | {scene.status ?? "Preview"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background p-6 text-center">
                  <ImageIcon className="size-10 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Nenhuma cena carregada ainda.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Depois da busca, as previews aparecem aqui.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultado e historico</CardTitle>
              <CardDescription>Jobs recentes da organizacao atual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {job ? (
                <div className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{job.originalFilename ?? "Job BuscaGEO"}</p>
                      <p className="text-xs text-muted-foreground">{job.status} | {job.jobId}</p>
                    </div>
                    {job.status === "done" ? <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" /> : null}
                    {job.status === "failed" ? <XCircle className="size-5 text-destructive" aria-hidden="true" /> : null}
                  </div>
                  {job.downloadUrl ? (
                    <Button asChild className="mt-3 w-full" variant="outline">
                      <a href={job.downloadUrl}>
                        <Download aria-hidden="true" />
                        Baixar GeoTIFF final
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {history.length ? (
                  history.map((item) => (
                    <button
                      key={item.jobId}
                      type="button"
                      onClick={() => {
                        setJob(item);
                        setSelectedSceneIds(item.selectedSceneIds);
                      }}
                      className="w-full rounded-md border bg-background p-3 text-left text-sm hover:border-primary/60"
                    >
                      <p className="truncate font-medium">{item.originalFilename ?? "Job BuscaGEO"}</p>
                      <p className="text-xs text-muted-foreground">{item.status} | {item.createdAt?.slice(0, 10) ?? ""}</p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">Nenhum job no historico.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logs</CardTitle>
            </CardHeader>
            <CardContent className="max-h-60 space-y-2 overflow-y-auto text-sm">
              {job?.logs.length ? (
                job.logs.map((log, index) => (
                  <p key={`${log.at ?? "log"}-${index}`} className="rounded-md bg-secondary px-3 py-2">
                    {log.message}
                  </p>
                ))
              ) : (
                <p className="text-muted-foreground">Sem logs ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Progresso</span>
        <span className="text-muted-foreground">{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function AreaPreview({ job }: { job: BuscaGeoJobResponse | null }) {
  if (!job?.bbox) {
    return (
      <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
        A BBOX e a area aparecem depois da leitura pelo worker.
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-background p-3 text-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-medium">Area reconhecida</p>
        <p className="text-xs text-muted-foreground">{job.areaHa ? `${job.areaHa.toLocaleString("pt-BR")} ha aprox.` : "Area pendente"}</p>
      </div>
      <div className="relative h-36 overflow-hidden rounded-md border bg-[linear-gradient(90deg,hsl(var(--muted))_1px,transparent_1px),linear-gradient(hsl(var(--muted))_1px,transparent_1px)] bg-[size:20px_20px]">
        <div className="absolute inset-x-[22%] inset-y-[18%] rounded border-2 border-primary/80 bg-primary/10" />
      </div>
      <p className="mt-2 break-words text-xs text-muted-foreground">BBOX: [{job.bbox.map((value) => value.toFixed(7)).join(", ")}]</p>
    </div>
  );
}

function StatusBanner({
  icon,
  text,
  tone,
}: {
  icon: React.ReactNode;
  text: string;
  tone: "error" | "notice";
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
        tone === "error"
          ? "border-destructive/25 bg-destructive/10 text-destructive"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
