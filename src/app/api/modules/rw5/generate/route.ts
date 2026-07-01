import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { insertModuleJob, tryUploadModuleText } from "@/lib/modules/jobs";
import { buildRw5, parseRw5Text } from "@/lib/modules/rw5/converter";
import { readUploadedText, sanitizeDownloadName } from "@/lib/modules/shared-text";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await requireOrganization(supabase, user.id);
  if (!context.organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }
  const organization = context.organization;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo TXT, PTS ou MC." }, { status: 400 });
  }

  const outputFilename = String(formData.get("outputFilename") ?? "").trim();
  const crs = String(formData.get("crs") ?? "EPSG:31982").trim() || "EPSG:31982";
  const equipment = String(formData.get("equipment") ?? "auto").trim() || "auto";
  const antennaRw5 = String(formData.get("antennaRw5") ?? "").trim();
  const hrOffset = Number(String(formData.get("hrOffset") ?? "0.0813").replace(",", "."));

  const { text, encoding } = await readUploadedText(file);
  const parsed = parseRw5Text(text, { encoding, sourceName: file.name, crs });
  if (!parsed.points.length) {
    return NextResponse.json({ error: "Nenhum ponto reconhecido para gerar RW5." }, { status: 400 });
  }
  const rw5 = buildRw5({
    points: parsed.points,
    filename: file.name,
    outputFilename,
    crs,
    equipment,
    antennaRw5,
    hrOffset: Number.isFinite(hrOffset) ? hrOffset : 0.0813,
  });

  const job = await insertModuleJob(supabase, "module_rw5_jobs", {
    organization_id: organization.id,
    user_id: user.id,
    original_filename: file.name,
    output_filename: outputFilename || `${sanitizeDownloadName(file.name, "levantamento")}.rw5`,
    input_format: parsed.inputFormat,
    crs,
    equipment,
    antenna_rw5: antennaRw5 || parsed.detectedAntennaType,
    hr_offset: Number.isFinite(hrOffset) ? hrOffset : 0.0813,
    base_count: parsed.baseCount,
    point_count: parsed.pointCount,
    warnings: parsed.warnings,
    metadata: {
      delimiter: parsed.delimiter,
      corrections: parsed.corrections,
      detectedAntennaType: parsed.detectedAntennaType,
      detectedEquipment: parsed.detectedEquipment,
    },
  });

  const basePath = `organizations/${organization.id}/modules/gerador-rw5/${job.id}`;
  const [originalUpload, resultUpload] = await Promise.all([
    tryUploadModuleText({
      supabase,
      path: `${basePath}/original`,
      content: new Blob([text], { type: "text/plain;charset=utf-8" }),
      contentType: "text/plain",
    }),
    tryUploadModuleText({
      supabase,
      path: `${basePath}/resultado.rw5`,
      content: rw5,
      contentType: "text/plain",
    }),
  ]);

  return NextResponse.json({
    jobId: job.id,
    persisted: job.persisted,
    filename: outputFilename ? `${sanitizeDownloadName(outputFilename, "levantamento")}.rw5` : `${sanitizeDownloadName(file.name, "levantamento")}.rw5`,
    resultText: rw5,
    parsed,
    originalStoragePath: originalUpload.path,
    resultStoragePath: resultUpload.path,
    warnings: [
      ...parsed.warnings,
      job.warning,
      originalUpload.warning,
      resultUpload.warning,
    ].filter(Boolean),
  });
}
