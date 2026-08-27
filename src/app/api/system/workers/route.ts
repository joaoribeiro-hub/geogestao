import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext, requireOrganizationAdminOrOwner } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { inspectWorker, WORKER_DEFINITIONS } from "@/lib/workers/worker-registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await getCurrentOrganizationContext(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  try {
    await requireOrganizationAdminOrOwner(supabase, organization.id, user.id);
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
