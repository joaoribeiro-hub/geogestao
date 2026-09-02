import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { inspectWorker, WORKER_DEFINITIONS } from "@/lib/workers/worker-registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  try {
    await requirePlatformDeveloper(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }

  const workerKey = new URL(request.url).searchParams.get("worker");
  const definition = workerKey ? WORKER_DEFINITIONS.find((item) => item.key === workerKey) : null;
  if (workerKey && !definition) return NextResponse.json({ error: "Worker desconhecido." }, { status: 400 });

  const workers = definition
    ? [await inspectWorker(definition)]
    : WORKER_DEFINITIONS.map((item) => {
        const config = inspectWorkerConfigWithoutHealth(item);
        return config;
      });
  return NextResponse.json({ workers });
}

function inspectWorkerConfigWithoutHealth(definition: (typeof WORKER_DEFINITIONS)[number]) {
  const url = (process.env[definition.urlEnv] ?? "").trim().replace(/\/$/, "");
  return {
    key: definition.key,
    name: definition.name,
    url,
    urlConfigured: Boolean(url),
    secretConfigured: Boolean(process.env[definition.secretEnv]),
    health: null,
  };
}
