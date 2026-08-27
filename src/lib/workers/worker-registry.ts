import { getWorkerHealth, normalizeWorkerUrl, type WorkerHealth } from "@/lib/workers/worker-client";

export const WORKER_DEFINITIONS = [
  {
    key: "buscageo",
    name: "BuscaGEO",
    urlEnv: "BUSCAGEO_WORKER_URL",
    secretEnv: "BUSCAGEO_WORKER_SECRET",
  },
  {
    key: "analise-ambiental",
    name: "Análise Ambiental",
    urlEnv: "ANALISE_AMBIENTAL_WORKER_URL",
    secretEnv: "ANALISE_AMBIENTAL_WORKER_SECRET",
  },
  {
    key: "sophia-documents",
    name: "Documentos da Sophia",
    urlEnv: "SOPHIA_DOCUMENT_WORKER_URL",
    secretEnv: "SOPHIA_DOCUMENT_WORKER_SECRET",
  },
] as const;

export type WorkerDefinition = (typeof WORKER_DEFINITIONS)[number];

export function getWorkerConfig(definition: WorkerDefinition) {
  const url = normalizeWorkerUrl(process.env[definition.urlEnv]);
  return {
    key: definition.key,
    name: definition.name,
    url,
    urlConfigured: Boolean(url),
    secretConfigured: Boolean(process.env[definition.secretEnv]),
  };
}

export async function inspectWorker(definition: WorkerDefinition): Promise<{
  key: string;
  name: string;
  url: string;
  urlConfigured: boolean;
  secretConfigured: boolean;
  health: WorkerHealth | null;
}> {
  const config = getWorkerConfig(definition);
  const health = config.urlConfigured ? await getWorkerHealth(config.url) : null;
  return { ...config, health };
}
