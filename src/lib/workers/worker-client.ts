type JsonObject = Record<string, unknown>;

export type WorkerHealth = {
  ok: boolean;
  status: number | null;
  service: string | null;
  payload: JsonObject | null;
  latencyMs: number;
  recoveryAttempted?: boolean;
  message?: string;
};

export type WorkerCallResult = {
  ok: boolean;
  status: number;
  data: JsonObject | null;
  workerStatus: "ready" | "waking" | "unavailable" | "not_configured";
  attempts: number;
  message?: string;
};

export type WorkerClientOptions = {
  url: string;
  secret?: string;
  path: string;
  method?: "POST" | "PUT" | "PATCH" | "GET";
  body?: JsonObject;
  initialTimeoutMs?: number;
  maxWaitMs?: number;
  retryDelayMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_WAIT_MS = 90_000;
const DEFAULT_RETRY_DELAY_MS = 5_000;
const wakingWorkers = new Map<string, Promise<WorkerHealth>>();

export function normalizeWorkerUrl(url: string | undefined | null) {
  return (url ?? "").trim().replace(/\/$/, "");
}

export function workerHealthMessage(url: string) {
  return `Worker indisponivel em ${normalizeWorkerUrl(url) || "URL nao configurada"}. O Render Free pode estar acordando; tente novamente em alguns instantes.`;
}

function asJsonObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function isValidWorkerPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !path.includes("..") && !/^https?:/i.test(path);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response) {
  return asJsonObject(await response.json().catch(() => null));
}

export async function getWorkerHealth(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<WorkerHealth> {
  const normalizedUrl = normalizeWorkerUrl(url);
  if (!normalizedUrl) {
    return { ok: false, status: null, service: null, payload: null, latencyMs: 0, message: "URL do worker nao configurada." };
  }

  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(`${normalizedUrl}/health`, { method: "GET" }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const payload = await readJson(response);
    return {
      ok: response.ok && payload?.status === "ok",
      status: response.status,
      service: typeof payload?.service === "string" ? payload.service : typeof payload?.worker === "string" ? payload.worker : null,
      payload,
      latencyMs: Date.now() - startedAt,
      message: response.ok ? undefined : `Health check retornou HTTP ${response.status}.`,
    };
  } catch {
    return {
      ok: false,
      status: null,
      service: null,
      payload: null,
      latencyMs: Date.now() - startedAt,
      message: workerHealthMessage(normalizedUrl),
    };
  }
}

export async function wakeWorker(
  url: string,
  options: { maxWaitMs?: number; initialTimeoutMs?: number; retryDelayMs?: number } = {},
) {
  const normalizedUrl = normalizeWorkerUrl(url);
  if (!normalizedUrl) return getWorkerHealth(normalizedUrl);

  const existing = wakingWorkers.get(normalizedUrl);
  if (existing) return existing;

  const promise = (async () => {
    const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    const initialTimeoutMs = options.initialTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const deadline = Date.now() + maxWaitMs;
    let health = await getWorkerHealth(normalizedUrl, { timeoutMs: Math.min(initialTimeoutMs, Math.max(1, maxWaitMs)) });
    const recoveryAttempted = !health.ok;
    while (!health.ok && Date.now() < deadline) {
      const remainingMs = deadline - Date.now();
      if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(retryDelayMs, remainingMs)));
      if (Date.now() >= deadline) break;
      health = await getWorkerHealth(normalizedUrl, { timeoutMs: Math.min(initialTimeoutMs, Math.max(1, deadline - Date.now())) });
    }
    return { ...health, recoveryAttempted };
  })().finally(() => {
    wakingWorkers.delete(normalizedUrl);
  });

  wakingWorkers.set(normalizedUrl, promise);
  return promise;
}

export async function callWorkerWithRetry(options: WorkerClientOptions): Promise<WorkerCallResult> {
  const normalizedUrl = normalizeWorkerUrl(options.url);
  if (!normalizedUrl || !options.secret) {
    return {
      ok: false,
      status: 503,
      data: { error: "Worker nao configurado no servidor." },
      workerStatus: "not_configured",
      attempts: 0,
      message: "Worker nao configurado no servidor.",
    };
  }
  if (!isValidWorkerPath(options.path)) {
    return {
      ok: false,
      status: 400,
      data: { error: "Rota interna de worker invalida." },
      workerStatus: "unavailable",
      attempts: 0,
      message: "Rota interna de worker invalida.",
    };
  }

  const health = await wakeWorker(normalizedUrl, options);
  const wokeFromColdStart = health.recoveryAttempted === true;
  if (!health.ok) {
    return {
      ok: false,
      status: 503,
      data: { error: health.message ?? workerHealthMessage(normalizedUrl) },
      workerStatus: "unavailable",
      attempts: 1,
      message: health.message ?? workerHealthMessage(normalizedUrl),
    };
  }

  try {
    const response = await fetchWithTimeout(`${normalizedUrl}${options.path}`, {
      method: options.method ?? "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.secret}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }, options.initialTimeoutMs ?? DEFAULT_TIMEOUT_MS);
    const data = await readJson(response);
    return {
      ok: response.ok,
      status: response.status,
      data,
      workerStatus: response.ok && wokeFromColdStart ? "waking" : response.ok ? "ready" : "unavailable",
      attempts: 1,
      message: response.ok && wokeFromColdStart ? "Worker acordando no Render Free. A solicitação foi encaminhada." : undefined,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      data: { error: workerHealthMessage(normalizedUrl) },
      workerStatus: "unavailable",
      attempts: 1,
      message: workerHealthMessage(normalizedUrl),
    };
  }
}
