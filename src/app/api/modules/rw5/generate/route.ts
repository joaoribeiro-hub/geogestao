import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { insertModuleJob, tryUploadModuleText } from "@/lib/modules/jobs";
import { buildRw5, buildRw5CoordinatesTable, createRw5ValidationReport, parseRw5Text } from "@/lib/modules/rw5/converter";
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
    return NextResponse.json({ error: "Envie um arquivo TXT, PTS, MC, CSV ou XLSX." }, { status: 400 });
  }

  const outputFilename = String(formData.get("outputFilename") ?? "").trim();
  const jobName = String(formData.get("jobName") ?? "").trim();
  const jobCreationDate = String(formData.get("jobCreationDate") ?? "").trim();
  const jobCreationTime = String(formData.get("jobCreationTime") ?? "").trim();
  const softwareVersion = String(formData.get("softwareVersion") ?? "8.2.0.1.20251117").trim();
  const crs = String(formData.get("crs") ?? "EPSG:31982").trim() || "EPSG:31982";
  const equipment = String(formData.get("equipment") ?? "auto").trim() || "auto";
  const baseEquipment = String(formData.get("baseEquipment") ?? "auto").trim() || "auto";
  const baseHeightType = String(formData.get("baseHeightType") ?? "").trim() === "Slant" ? "Slant" : "Vertical";
  const defaultRoverHr = Number(String(formData.get("defaultRoverHr") ?? "1.700").replace(",", "."));
  const defaultAgeText = String(formData.get("defaultAge") ?? "").trim();
  const defaultAge = defaultAgeText ? Number(defaultAgeText.replace(",", ".")) : null;

  let text: string;
  let parsed: ReturnType<typeof parseRw5Text>;
  let validation: ReturnType<typeof createRw5ValidationReport>;
  let rw5: string;
  let coordinatesText: string;
  try {
    const uploaded = await readUploadedText(file);
    text = uploaded.text;
    parsed = parseRw5Text(text, {
      encoding: uploaded.encoding,
      sourceName: file.name,
      crs,
      defaultRoverHr: Number.isFinite(defaultRoverHr) ? defaultRoverHr : 1.7,
      defaultAge: Number.isFinite(defaultAge) ? defaultAge : null,
    });
    validation = createRw5ValidationReport(parsed, {
      jobCreationDate,
      jobCreationTime,
      roverEquipment: equipment,
      baseEquipment,
      defaultAge: Number.isFinite(defaultAge) ? defaultAge : null,
      requireJobFields: true,
    });
    if (validation.erros_bloqueantes.length) {
      return NextResponse.json({ error: validation.erros_bloqueantes[0], validation }, { status: 400 });
    }
    try {
      rw5 = buildRw5({
        points: parsed.points,
        filename: file.name,
        outputFilename,
        jobName,
        jobCreationDate,
        jobCreationTime,
        softwareVersion,
        crs,
        equipment,
        baseEquipment,
        baseHeightType,
        defaultAge: Number.isFinite(defaultAge) ? defaultAge : null,
      });
      coordinatesText = buildRw5CoordinatesTable(parsed.points, crs);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel validar os equipamentos e gerar o RW5.";
      validation.erros_bloqueantes = [...new Set([...validation.erros_bloqueantes, message])];
      return NextResponse.json({ error: message, validation }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel gerar o RW5." }, { status: 400 });
  }

  const job = await insertModuleJob(supabase, "module_rw5_jobs", {
    organization_id: organization.id,
    user_id: user.id,
    original_filename: file.name,
    output_filename: outputFilename || `${sanitizeDownloadName(file.name, "levantamento")}.rw5`,
    input_format: parsed.inputFormat,
    crs,
    equipment,
    antenna_rw5: parsed.detectedAntennaType,
    hr_offset: 0,
    base_count: parsed.baseCount,
    point_count: parsed.pointCount,
    warnings: validation.avisos,
    metadata: {
      delimiter: parsed.delimiter,
      corrections: parsed.corrections,
      detectedAntennaType: parsed.detectedAntennaType,
      detectedEquipment: parsed.detectedEquipment,
      validation,
      jobName,
      jobCreationDate,
      jobCreationTime,
      softwareVersion,
      roverEquipmentProfile: equipment,
      baseEquipmentProfile: baseEquipment,
      baseHeightType,
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

  const rw5Filename = outputFilename
    ? `${sanitizeDownloadName(outputFilename, "levantamento")}.rw5`
    : `${sanitizeDownloadName(file.name, "levantamento")}.rw5`;
  const coordinatesFilename = `${rw5Filename.replace(/\.rw5$/i, "")}_latitude_longitude.txt`;

  return NextResponse.json({
    jobId: job.id,
    persisted: job.persisted,
    filename: rw5Filename,
    coordinatesFilename,
    coordinatesText,
    resultText: rw5,
    parsed,
    validation,
    originalStoragePath: originalUpload.path,
    resultStoragePath: resultUpload.path,
    warnings: [
      ...validation.avisos,
      job.warning,
      originalUpload.warning,
      resultUpload.warning,
    ].filter(Boolean),
  });
}
