import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { DOCUMENTS_BUCKET, MAX_DOCUMENT_FILE_SIZE_BYTES, sanitizeDocumentFileName } from "@/lib/documents/storage";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";
import { requestEnvironmentalWorkerProcess } from "@/lib/tools/analise-ambiental/worker";

const allowedMimeTypes = new Set([
  "application/vnd.google-earth.kml+xml",
  "application/vnd.google-earth.kmz",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "text/xml",
  "application/xml",
]);

const allowedExtensions = [".kml", ".kmz", ".zip"];
const allowedRasterExtensions = [".tif", ".tiff", ".geotiff"];

const jobSelect =
  "id,status,original_filename,created_at,input_size_bytes,requested_layers,area_ha,bbox,result_summary,warnings,output_storage_paths,error_message,finished_at,progress,input_raster_storage_path";

const defaultRequestedLayers = ["vegetacao_nativa", "agropecuaria", "agua"];

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const organization = context.organization;
  if (!organization || !context.membership) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 403 });
  }

  const db = asUntypedSupabase(supabase);
  const { data, error } = await db
    .from("module_environmental_analysis_jobs")
    .select(jobSelect)
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const organization = context.organization;
  if (!organization || !context.membership) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo KML, KMZ ou ZIP." }, { status: 400 });
  }

  const validation = validateEnvironmentalFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const requestedLayers = formData.getAll("layers").map(String).filter(Boolean);
  const rasterFile = formData.get("rasterFile");
  if (rasterFile instanceof File && rasterFile.size > 0) {
    const rasterValidation = validateRasterFile(rasterFile);
    if (!rasterValidation.ok) {
      return NextResponse.json({ error: rasterValidation.reason }, { status: 400 });
    }
  }

  const jobId = randomUUID();
  const safeName = sanitizeDocumentFileName(file.name);
  const storagePath = `organizations/${organization.id}/tools/analise-ambiental/${jobId}/input/${safeName}`;
  let rasterStoragePath: string | null = null;

  const upload = await supabase.storage.from(DOCUMENTS_BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  if (rasterFile instanceof File && rasterFile.size > 0) {
    const safeRasterName = sanitizeDocumentFileName(rasterFile.name);
    rasterStoragePath = `organizations/${organization.id}/tools/analise-ambiental/${jobId}/input/${safeRasterName}`;
    const rasterUpload = await supabase.storage.from(DOCUMENTS_BUCKET).upload(rasterStoragePath, rasterFile, {
      upsert: false,
      contentType: "application/octet-stream",
    });
    if (rasterUpload.error) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: rasterUpload.error.message }, { status: 500 });
    }
  }

  const db = asUntypedSupabase(supabase);
  const { data: job, error } = await db
    .from("module_environmental_analysis_jobs")
    .insert({
      id: jobId,
      organization_id: organization.id,
      user_id: user.id,
      status: "worker_pendente",
      original_filename: file.name,
      input_storage_path: storagePath,
      input_raster_storage_path: rasterStoragePath,
      input_mime_type: file.type || "application/octet-stream",
      input_size_bytes: file.size,
      requested_layers: requestedLayers.length ? requestedLayers : defaultRequestedLayers,
      logs: [
        {
          at: new Date().toISOString(),
          message: "Arquivo recebido e job ambiental criado. Aguardando worker Python.",
        },
      ],
    })
    .select(jobSelect)
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath, rasterStoragePath].filter(Boolean) as string[]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wakeResult = await requestEnvironmentalWorkerProcess(jobId);

  return NextResponse.json({
    job,
    worker: wakeResult.ok
      ? wakeResult
      : {
          ok: false,
          message:
            "Job criado e aguardando worker. Configure o worker ambiental ou clique em Processar agora quando ele estiver ativo.",
        },
  });
}

function validateRasterFile(file: File) {
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return { ok: false as const, reason: "O raster deve ter no máximo 50 MB nesta fase." };
  }
  const lowerName = file.name.toLowerCase();
  const hasKnownExtension = allowedRasterExtensions.some((extension) => lowerName.endsWith(extension));
  if (!hasKnownExtension) {
    return { ok: false as const, reason: "Envie um GeoTIFF .tif ou .tiff para teste MapBiomas local." };
  }
  return { ok: true as const };
}

function validateEnvironmentalFile(file: File) {
  if (file.size <= 0) {
    return { ok: false as const, reason: "Arquivo inválido." };
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return { ok: false as const, reason: "O arquivo deve ter no máximo 50 MB." };
  }

  const lowerName = file.name.toLowerCase();
  const hasKnownExtension = allowedExtensions.some((extension) => lowerName.endsWith(extension));
  const hasKnownMime = allowedMimeTypes.has(file.type || "application/octet-stream");
  if (!hasKnownExtension && !hasKnownMime) {
    return { ok: false as const, reason: "Envie KML, KMZ ou ZIP com a área da propriedade." };
  }

  return { ok: true as const };
}
