import { callWorkerWithRetry, getWorkerHealth } from "@/lib/workers/worker-client";

export type EnvironmentalWorkerWakeResult =
  | { ok: true; message: string; workerStatus: "ready" | "waking" }
  | { ok: false; message: string; status?: number };

export function getEnvironmentalWorkerConfig() {
  const url = process.env.ANALISE_AMBIENTAL_WORKER_URL?.replace(/\/$/, "") ?? "";
  const secret = process.env.ANALISE_AMBIENTAL_WORKER_SECRET ?? "";
  return { url, secret, configured: Boolean(url && secret) };
}

export type EnvironmentalWorkerHealth = {
  ok: boolean;
  status?: number | null;
  service?: string | null;
  latencyMs?: number;
  providers?: {
    hidrografia_oficial?: {
      configured?: boolean;
      source?: string;
      version?: string;
    };
  };
};

export async function getEnvironmentalWorkerHealth(): Promise<EnvironmentalWorkerHealth> {
  const config = getEnvironmentalWorkerConfig();
  if (!config.url) return { ok: false };
  const result = await getWorkerHealth(config.url);
  return {
    ok: result.ok,
    status: result.status,
    service: result.service,
    latencyMs: result.latencyMs,
    providers: result.payload?.providers as EnvironmentalWorkerHealth["providers"],
  };
}

export async function requestEnvironmentalWorkerProcess(jobId: string): Promise<EnvironmentalWorkerWakeResult> {
  const config = getEnvironmentalWorkerConfig();
  if (!config.configured) {
    return {
      ok: false,
      message:
        "Worker ambiental não configurado. Configure ANALISE_AMBIENTAL_WORKER_URL e ANALISE_AMBIENTAL_WORKER_SECRET no servidor.",
    };
  }

  const result = await callWorkerWithRetry({
    url: config.url,
    secret: config.secret,
    path: `/jobs/${jobId}/process`,
    method: "POST",
  });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: typeof result.data?.message === "string"
        ? result.data.message
        : typeof result.data?.detail === "string"
          ? result.data.detail
          : result.message ?? "Não foi possível chamar o worker ambiental.",
    };
  }
  return {
    ok: true,
    workerStatus: result.workerStatus === "waking" ? "waking" : "ready",
    message: result.message ?? (typeof result.data?.message === "string" ? result.data.message : "Processamento enviado ao worker ambiental."),
  };
}
