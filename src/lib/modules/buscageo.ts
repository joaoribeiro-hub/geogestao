import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

type SupabaseLike = {
  from: unknown;
};

type QueryError = { message: string } | null;

type UntypedQueryResult = Promise<{ data: unknown; error: QueryError }>;

type UntypedQueryBuilder = {
  select: (columns?: string) => UntypedQueryBuilder;
  insert: (values: unknown) => UntypedQueryBuilder;
  update: (values: Record<string, unknown>) => UntypedQueryBuilder;
  eq: (column: string, value: unknown) => UntypedQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQueryBuilder;
  limit: (count: number) => UntypedQueryBuilder;
  single: () => UntypedQueryResult;
  maybeSingle: () => UntypedQueryResult;
  then: PromiseLike<{ data: unknown; error: QueryError }>["then"];
};

export type BuscaGeoJobRow = Record<string, unknown>;

export const BUSCAGEO_BUCKET = process.env.BUSCAGEO_STORAGE_BUCKET || "documentos";

export const BUSCAGEO_ALLOWED_EXTENSIONS = new Set([".kml", ".kmz", ".zip"]);

export type BuscaGeoScene = {
  imageId: string;
  stacId?: string | null;
  imageDate?: string | null;
  assetName?: string | null;
  cloudCover?: number | null;
  status?: string | null;
  previewStoragePath?: string | null;
  originalStoragePath?: string | null;
  previewUrl?: string | null;
};

export type BuscaGeoJobResponse = {
  jobId: string;
  status: string;
  phase: string;
  progress: number;
  message: string;
  bbox: [number, number, number, number] | null;
  areaHa: number | null;
  originalFilename: string | null;
  inputStoragePath: string | null;
  scenes: BuscaGeoScene[];
  selectedSceneIds: string[];
  previewUrl: string | null;
  downloadUrl: string | null;
  downloadFilename: string | null;
  logs: Array<{ at?: string; message: string }>;
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function buscaGeoJobsTable(supabase: SupabaseLike) {
  return (supabase.from as (table: string) => UntypedQueryBuilder)("module_buscageo_jobs");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function getBuscaGeoExtension(filename: string) {
  return filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

export function assertBuscaGeoFile(filename: string) {
  const extension = getBuscaGeoExtension(filename);
  if (!BUSCAGEO_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Envie um arquivo KML, KMZ ou ZIP de Shapefile.");
  }
}

export function safeBuscaGeoFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "perimetro";
}

export function buildBuscaGeoStoragePath({
  organizationId,
  jobId,
  kind,
  filename,
}: {
  organizationId: string;
  jobId: string;
  kind: "input" | "preview" | "output" | "logs";
  filename: string;
}) {
  return `organizations/${organizationId}/modules/buscageo/${jobId}/${kind}/${safeBuscaGeoFilename(filename)}`;
}

export function toBuscaGeoProgress(status: string, rawProgress: unknown) {
  const numeric = typeof rawProgress === "number" ? rawProgress : Number(rawProgress ?? 0);
  if (Number.isFinite(numeric) && numeric > 0) return Math.max(0, Math.min(100, Math.round(numeric)));
  const defaults: Record<string, number> = {
    draft: 0,
    uploaded: 5,
    reading_geometry: 10,
    geometry_ready: 20,
    searching_scenes: 35,
    scenes_ready: 100,
    processing: 50,
    done: 100,
    failed: 100,
    canceled: 100,
    worker_pending: 5,
  };
  return defaults[status] ?? 0;
}

export function toBuscaGeoPhase(status: string) {
  if (status === "processing" || status === "done") return "mosaic";
  if (status === "reading_geometry" || status === "geometry_ready" || status === "searching_scenes" || status === "scenes_ready") return "preview";
  return status === "done" ? "done" : "preview";
}

export function toBuscaGeoMessage(status: string, fallback?: string | null) {
  if (fallback) return fallback;
  const messages: Record<string, string> = {
    draft: "Aguardando upload.",
    uploaded: "Arquivo recebido.",
    reading_geometry: "Lendo area no worker.",
    geometry_ready: "Geometria lida.",
    searching_scenes: "Buscando imagens CBERS.",
    scenes_ready: "Previews prontas.",
    processing: "Processando mosaico.",
    done: "GeoTIFF final pronto.",
    failed: "Processamento falhou.",
    canceled: "Job cancelado.",
    worker_pending: "Worker BuscaGEO aguardando configuracao.",
  };
  return messages[status] ?? "Aguardando processamento.";
}

export async function mapBuscaGeoJob(
  supabase: ServerSupabase,
  row: BuscaGeoJobRow,
): Promise<BuscaGeoJobResponse> {
  const scenes = Array.isArray(row.scenes) ? row.scenes : [];
  const selected = Array.isArray(row.selected_scenes) ? row.selected_scenes : [];
  const parameters = asRecord(row.parameters);
  const bbox =
    Array.isArray(row.bbox) && row.bbox.length === 4
      ? (row.bbox.map((value: unknown) => Number(value)) as [number, number, number, number])
      : null;
  const signedScenes = await Promise.all(
    scenes.map(async (scene): Promise<BuscaGeoScene> => {
      const sceneRecord = asRecord(scene);
      const previewStoragePath = sceneRecord.previewStoragePath ?? sceneRecord.preview_storage_path ?? null;
      return {
        imageId: String(sceneRecord.imageId ?? sceneRecord.id ?? sceneRecord.stacId ?? crypto.randomUUID()),
        stacId: typeof sceneRecord.stacId === "string" ? sceneRecord.stacId : typeof sceneRecord.stac_id === "string" ? sceneRecord.stac_id : null,
        imageDate: typeof sceneRecord.imageDate === "string" ? sceneRecord.imageDate : typeof sceneRecord.image_date === "string" ? sceneRecord.image_date : null,
        assetName: typeof sceneRecord.assetName === "string" ? sceneRecord.assetName : typeof sceneRecord.asset_name === "string" ? sceneRecord.asset_name : null,
        cloudCover: typeof sceneRecord.cloudCover === "number" ? sceneRecord.cloudCover : typeof sceneRecord.cloud_cover === "number" ? sceneRecord.cloud_cover : null,
        status: typeof sceneRecord.status === "string" ? sceneRecord.status : "Preview pronta",
        originalStoragePath: typeof sceneRecord.originalStoragePath === "string" ? sceneRecord.originalStoragePath : typeof sceneRecord.original_storage_path === "string" ? sceneRecord.original_storage_path : null,
        previewStoragePath: typeof previewStoragePath === "string" ? previewStoragePath : null,
        previewUrl: typeof previewStoragePath === "string" ? await createSignedUrl(supabase, previewStoragePath) : null,
      };
    }),
  );

  return {
    jobId: String(row.id),
    status: String(row.status),
    phase: toBuscaGeoPhase(String(row.status)),
    progress: toBuscaGeoProgress(String(row.status), parameters.progress),
    message: toBuscaGeoMessage(String(row.status), typeof parameters.message === "string" ? parameters.message : null),
    bbox,
    areaHa: typeof row.area_ha === "number" ? row.area_ha : row.area_ha ? Number(row.area_ha) : null,
    originalFilename: typeof row.input_filename === "string" ? row.input_filename : null,
    inputStoragePath: typeof row.input_storage_path === "string" ? row.input_storage_path : null,
    scenes: signedScenes,
    selectedSceneIds: selected.map((item: unknown) => String(item)),
    previewUrl: typeof row.preview_storage_path === "string" ? await createSignedUrl(supabase, row.preview_storage_path) : null,
    downloadUrl: row.output_storage_path ? `/api/modules/buscageo/jobs/${row.id}/download` : null,
    downloadFilename: typeof row.output_filename === "string" ? row.output_filename : null,
    logs: Array.isArray(row.logs)
      ? row.logs.map((log) => {
          const item = asRecord(log);
          return { at: typeof item.at === "string" ? item.at : undefined, message: String(item.message ?? "") };
        })
      : [],
    error: typeof row.error_message === "string" ? row.error_message : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function createSignedUrl(supabase: ServerSupabase, path: string) {
  const { data, error } = await supabase.storage.from(BUSCAGEO_BUCKET).createSignedUrl(path, 60 * 5);
  if (error) return null;
  return data.signedUrl;
}

export async function callBuscaGeoWorker(path: string, payload: Record<string, unknown>) {
  const workerUrl = process.env.BUSCAGEO_WORKER_URL?.replace(/\/$/, "");
  const workerSecret = process.env.BUSCAGEO_WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    return {
      ok: false,
      status: 503,
      data: {
        error: "Worker BuscaGEO nao configurado. Defina BUSCAGEO_WORKER_URL e BUSCAGEO_WORKER_SECRET.",
      },
    };
  }

  const response = await fetch(`${workerUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${workerSecret}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

export async function loadBuscaGeoJobForUser(
  supabase: ServerSupabase,
  organizationId: string,
  jobId: string,
) {
  const { data, error } = await buscaGeoJobsTable(supabase)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BuscaGeoJobRow | null;
}

export function appendBuscaGeoLog(row: BuscaGeoJobRow | null, message: string) {
  const current = row && Array.isArray(row.logs) ? row.logs : [];
  return [...current, { at: new Date().toISOString(), message }];
}
