import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  BUSCAGEO_BUCKET,
  appendBuscaGeoLog,
  assertBuscaGeoFile,
  buscaGeoJobsTable,
  buildBuscaGeoStoragePath,
  mapBuscaGeoJob,
  safeBuscaGeoFilename,
  type BuscaGeoJobRow,
} from "@/lib/modules/buscageo";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await requireOrganization(supabase, user.id);
  if (!context.organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }

  const { data, error } = await buscaGeoJobsTable(supabase)
    .select("*")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = Array.isArray(data) ? (data as BuscaGeoJobRow[]) : [];
  const jobs = await Promise.all(rows.map((row) => mapBuscaGeoJob(supabase, row)));
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await requireOrganization(supabase, user.id);
  if (!context.organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um KML, KMZ ou ZIP de Shapefile." }, { status: 400 });
  }

  try {
    assertBuscaGeoFile(file.name);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Arquivo invalido." }, { status: 400 });
  }

  const parameters = {
    collection: String(formData.get("collection") ?? "CB4A-WPM-PCA-FUSED-1"),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    cloudCover: String(formData.get("cloudCover") ?? "30"),
    bboxFactor: String(formData.get("bboxFactor") ?? "1.5"),
    composition: String(formData.get("composition") ?? "cubic"),
    maxScenes: String(formData.get("maxScenes") ?? "30"),
    progress: 0,
    message: "Arquivo recebido.",
  };

  const { data: insertedRaw, error: insertError } = await buscaGeoJobsTable(supabase)
    .insert({
      organization_id: context.organization.id,
      user_id: user.id,
      status: "draft",
      input_filename: file.name,
      input_mime_type: file.type || "application/octet-stream",
      input_size_bytes: file.size,
      parameters,
      logs: [{ at: new Date().toISOString(), message: "Job criado no GeoGestao." }],
    })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  const inserted = insertedRaw as BuscaGeoJobRow;

  const inputPath = buildBuscaGeoStoragePath({
    organizationId: context.organization.id,
    jobId: String(inserted.id),
    kind: "input",
    filename: safeBuscaGeoFilename(file.name),
  });

  const upload = await supabase.storage.from(BUSCAGEO_BUCKET).upload(inputPath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });

  if (upload.error) {
    await buscaGeoJobsTable(supabase)
      .update({
        status: "failed",
        error_message: upload.error.message,
        logs: appendBuscaGeoLog(inserted, `Falha no upload para Storage: ${upload.error.message}`),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id)
      .eq("organization_id", context.organization.id);

    return NextResponse.json(
      {
        error: `Falha no upload para o bucket ${BUSCAGEO_BUCKET}. Aplique a migration de Storage/policies do BuscaGEO e tente novamente.`,
      },
      { status: 500 },
    );
  }

  const { data: updated, error: updateError } = await buscaGeoJobsTable(supabase)
    .update({
      status: "uploaded",
      input_storage_path: inputPath,
      parameters: { ...parameters, progress: 5, message: "Arquivo salvo no Storage." },
      logs: appendBuscaGeoLog(inserted, `Upload salvo em ${inputPath}.`),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inserted.id)
    .eq("organization_id", context.organization.id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json(await mapBuscaGeoJob(supabase, updated as BuscaGeoJobRow));
}
