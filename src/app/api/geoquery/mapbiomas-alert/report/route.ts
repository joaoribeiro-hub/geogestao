import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getAlertByCodeWithFallback,
  isMapBiomasAuthError,
  isMapBiomasUnavailableError,
} from "@/lib/services/mapbiomas-alert";
import {
  buildMapBiomasAlertReportPdf,
  mapBiomasAlertReportFileName,
} from "@/lib/services/mapbiomas-alert-report";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const reportSchema = z.object({
  carCode: z.string().trim().min(5, "Informe o CAR pesquisado."),
  alertCode: z.coerce.number().int().positive("Informe um codigo de alerta valido."),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Payload invalido." },
      { status: 400 },
    );
  }

  const { alertCode, carCode } = parsed.data;

  try {
    const { alert, fallbackWithoutCarUsed } = await getAlertByCodeWithFallback(alertCode, carCode);

    if (!alert) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "A API MapBiomas nao encontrou este alerta para o CAR pesquisado. O alerta pode pertencer a outro imovel ou nao estar disponivel na API v2.",
        },
        { status: 404 },
      );
    }

    const pdf = buildMapBiomasAlertReportPdf({ alert, alertCode, carCode });
    const fileName = mapBiomasAlertReportFileName(carCode, alertCode);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-GeoGestao-Message":
          fallbackWithoutCarUsed
            ? "PDF gerado pelo GeoGestao com dados retornados pela API MapBiomas sem filtro de CAR."
            : "PDF gerado pelo GeoGestao com dados retornados pela API MapBiomas.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: safeReportError(error),
      },
      { status: 502 },
    );
  }
}

function safeReportError(error: unknown) {
  if (isMapBiomasAuthError(error)) {
    return "Nao foi possivel autenticar na API MapBiomas. Verifique as variaveis do servidor.";
  }
  if (isMapBiomasUnavailableError(error)) {
    return "A API MapBiomas nao respondeu agora. Tente novamente mais tarde.";
  }
  return "Nao foi possivel gerar o PDF do laudo MapBiomas agora.";
}
