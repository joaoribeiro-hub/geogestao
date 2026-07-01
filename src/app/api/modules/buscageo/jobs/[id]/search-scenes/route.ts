import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appendBuscaGeoLog, buscaGeoJobsTable, callBuscaGeoWorker, loadBuscaGeoJobForUser, mapBuscaGeoJob, type BuscaGeoJobRow } from "@/lib/modules/buscageo";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await requireOrganization(supabase, user.id);
  if (!context.organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });

  const job = await loadBuscaGeoJobForUser(supabase, context.organization.id, id);
  if (!job) return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });
  if (!job.input_storage_path) return NextResponse.json({ error: "Job sem arquivo de entrada." }, { status: 400 });

  const pending = await updateJob(supabase, context.organization.id, id, {
    status: "searching_scenes",
    started_at: job.started_at ?? new Date().toISOString(),
    parameters: { ...(job.parameters ?? {}), progress: 35, message: "Buscando cenas CBERS." },
    logs: appendBuscaGeoLog(job, "Solicitada busca de cenas CBERS ao worker."),
  });

  const worker = await callBuscaGeoWorker(`/jobs/${id}/search-scenes`, {
    job_id: id,
    organization_id: context.organization.id,
    input_storage_path: job.input_storage_path,
    parameters: job.parameters ?? {},
    bbox: job.bbox,
    geometry: job.geometry,
    callback_url: new URL("/api/modules/buscageo/worker/callback", request.url).toString(),
  });

  if (!worker.ok) {
    const updated = await updateJob(supabase, context.organization.id, id, {
      status: "worker_pending",
      parameters: { ...(job.parameters ?? {}), progress: 35, message: worker.data?.error ?? "Worker nao configurado." },
      logs: appendBuscaGeoLog(pending, worker.data?.error ?? "Worker BuscaGEO nao configurado."),
    });
    return NextResponse.json(await mapBuscaGeoJob(supabase, updated), { status: worker.status === 503 ? 200 : worker.status });
  }

  return NextResponse.json(await mapBuscaGeoJob(supabase, pending));
}

async function updateJob(supabase: Awaited<ReturnType<typeof createServerSupabase>>, organizationId: string, id: string, values: Record<string, unknown>) {
  const { data, error } = await buscaGeoJobsTable(supabase)
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as BuscaGeoJobRow;
}
