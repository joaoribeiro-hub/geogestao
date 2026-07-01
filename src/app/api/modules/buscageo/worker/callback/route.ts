import { NextResponse } from "next/server";
import { appendBuscaGeoLog, buscaGeoJobsTable, type BuscaGeoJobRow } from "@/lib/modules/buscageo";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.BUSCAGEO_WORKER_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.replace(/^Bearer\s+/i, "");
  if (!expected || received !== expected) {
    return NextResponse.json({ error: "Worker nao autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.job_id || !body?.organization_id) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data: currentRaw, error: currentError } = await buscaGeoJobsTable(supabase)
    .select("*")
    .eq("id", body.job_id)
    .eq("organization_id", body.organization_id)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!currentRaw) return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });
  const current = currentRaw as BuscaGeoJobRow;

  const nextLogs = Array.isArray(body.logs)
    ? [...(Array.isArray(current.logs) ? current.logs : []), ...body.logs]
    : body.message
      ? appendBuscaGeoLog(current, String(body.message))
      : current.logs;

  const parameters = {
    ...(current.parameters && typeof current.parameters === "object" && !Array.isArray(current.parameters) ? current.parameters : {}),
    ...(body.parameters ?? {}),
    progress: body.progress,
    message: body.message,
    source_epsg: body.source_epsg,
    source_wkt: body.source_wkt,
  };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    logs: nextLogs,
    parameters,
  };
  for (const key of [
    "status",
    "geometry",
    "bbox",
    "area_ha",
    "scenes",
    "selected_scenes",
    "preview_storage_path",
    "output_storage_path",
    "output_filename",
    "error_message",
    "finished_at",
    "started_at",
  ]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.status === "done" && !updates.finished_at) updates.finished_at = new Date().toISOString();
  if (body.status === "failed" && !updates.finished_at) updates.finished_at = new Date().toISOString();

  const { data, error } = await buscaGeoJobsTable(supabase)
    .update(updates)
    .eq("id", body.job_id)
    .eq("organization_id", body.organization_id)
    .select("id,status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, job: data });
}
