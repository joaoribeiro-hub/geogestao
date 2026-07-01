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

  const body = await request.json().catch(() => ({}));
  const selectedSceneIds = Array.isArray(body.selectedSceneIds) ? body.selectedSceneIds.map(String).slice(0, 2) : [];
  if (!selectedSceneIds.length || selectedSceneIds.length > 2) {
    return NextResponse.json({ error: "Selecione de 1 a 2 cenas." }, { status: 400 });
  }

  const job = await loadBuscaGeoJobForUser(supabase, context.organization.id, id);
  if (!job) return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });

  const pending = await updateJob(supabase, context.organization.id, id, {
    status: "processing",
    selected_scenes: selectedSceneIds,
    started_at: job.started_at ?? new Date().toISOString(),
    parameters: { ...(job.parameters ?? {}), progress: 50, message: "Processando mosaico." },
    logs: appendBuscaGeoLog(job, `Processamento solicitado para ${selectedSceneIds.length} cena(s).`),
  });

  const worker = await callBuscaGeoWorker(`/jobs/${id}/process`, {
    job_id: id,
    organization_id: context.organization.id,
    selected_scene_ids: selectedSceneIds,
    scenes: job.scenes ?? [],
    parameters: job.parameters ?? {},
    callback_url: new URL("/api/modules/buscageo/worker/callback", request.url).toString(),
  });

  if (!worker.ok) {
    const updated = await updateJob(supabase, context.organization.id, id, {
      status: "worker_pending",
      parameters: { ...(job.parameters ?? {}), progress: 50, message: worker.data?.error ?? "Worker nao configurado." },
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
