import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { insertModuleJob, tryUploadModuleText } from "@/lib/modules/jobs";
import { readUploadedText, sanitizeDownloadName } from "@/lib/modules/shared-text";
import { calculateRtkCorrection, parseRtkText } from "@/lib/modules/rtk-ppp/converter";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  northing: z.coerce.number(),
  easting: z.coerce.number(),
  elevation: z.coerce.number(),
  decimals: z.coerce.number().refine((value): value is 3 | 4 => value === 3 || value === 4),
  outputDelimiter: z.enum(["tab", "comma", "semicolon"]),
  includeCorrectedBase: z.coerce.boolean().default(true),
});

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
    return NextResponse.json({ error: "Envie um arquivo TXT." }, { status: 400 });
  }

  const parsedOptions = schema.safeParse({
    northing: formData.get("northing"),
    easting: formData.get("easting"),
    elevation: formData.get("elevation"),
    decimals: formData.get("decimals"),
    outputDelimiter: formData.get("outputDelimiter"),
    includeCorrectedBase: formData.get("includeCorrectedBase") !== "false",
  });
  if (!parsedOptions.success) {
    return NextResponse.json({ error: "Parametros de correcao invalidos." }, { status: 400 });
  }

  const { text, encoding } = await readUploadedText(file);
  const parsed = parseRtkText(text, encoding);
  if (!parsed.base) {
    return NextResponse.json({ error: "Base levantada nao encontrada no arquivo." }, { status: 400 });
  }

  const delimiterMap = { tab: "\t", comma: ",", semicolon: ";" } as const;
  const correction = calculateRtkCorrection({
    base: parsed.base,
    correctedBase: {
      northing: parsedOptions.data.northing,
      easting: parsedOptions.data.easting,
      elevation: parsedOptions.data.elevation,
    },
    rovers: parsed.rovers,
    decimals: parsedOptions.data.decimals,
    outputDelimiter: delimiterMap[parsedOptions.data.outputDelimiter],
    includeCorrectedBase: parsedOptions.data.includeCorrectedBase,
  });

  const job = await insertModuleJob(supabase, "module_rtk_ppp_jobs", {
    organization_id: organization.id,
    user_id: user.id,
    original_filename: file.name,
    base_raw: parsed.base,
    base_corrected: {
      northing: parsedOptions.data.northing,
      easting: parsedOptions.data.easting,
      elevation: parsedOptions.data.elevation,
    },
    correction: correction.correction,
    rover_count: parsed.rovers.length,
    skipped_lines: parsed.skippedLines,
    warnings: [...parsed.warnings, jobWarningPlaceholder()].filter(Boolean),
    options: {
      decimals: parsedOptions.data.decimals,
      outputDelimiter: parsedOptions.data.outputDelimiter,
      includeCorrectedBase: parsedOptions.data.includeCorrectedBase,
    },
  });

  const basePath = `organizations/${organization.id}/modules/rtk-ppp/${job.id}`;
  const [originalUpload, resultUpload] = await Promise.all([
    tryUploadModuleText({
      supabase,
      path: `${basePath}/original.txt`,
      content: new Blob([text], { type: "text/plain;charset=utf-8" }),
      contentType: "text/plain",
    }),
    tryUploadModuleText({
      supabase,
      path: `${basePath}/corrigido.txt`,
      content: correction.resultText,
      contentType: "text/plain",
    }),
  ]);

  const downloadName = `${sanitizeDownloadName(file.name, "corrigido")}-corrigido.txt`;
  return NextResponse.json({
    ...correction,
    jobId: job.id,
    persisted: job.persisted,
    filename: downloadName,
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

function jobWarningPlaceholder() {
  return null;
}
