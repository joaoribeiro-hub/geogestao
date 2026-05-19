import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getAlertReportLinkOrData,
  getRuralPropertyAlerts,
  isMapBiomasAuthError,
  isMapBiomasUnavailableError,
} from "@/lib/services/mapbiomas-alert";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const mapBiomasAlertSchema = z
  .object({
    alertCode: z.coerce.number().int().positive().optional().nullable(),
    carCode: z.string().trim().optional().nullable(),
  })
  .refine((value) => Boolean(value.alertCode || value.carCode), {
    message: "Informe o codigo do alerta ou o CAR.",
  });

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  const parsed = mapBiomasAlertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Payload invalido." },
      { status: 400 },
    );
  }

  try {
    if (!parsed.data.alertCode) {
      const ruralProperty = await getRuralPropertyAlerts(parsed.data.carCode ?? "");
      const alerts = extractAlertsArray(ruralProperty);
      return NextResponse.json({
        ok: true,
        alert: null,
        ruralProperty,
        reportUrl: null,
        platformUrl: "https://plataforma.alerta.mapbiomas.org/",
        message: alerts.length
          ? "Consulta do CAR retornada pela API MapBiomas Alerta."
          : "A API MapBiomas nao retornou alertas para este CAR.",
      });
    }

    const result = await getAlertReportLinkOrData(
      parsed.data.alertCode,
      parsed.data.carCode ?? undefined,
    );
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: safeMapBiomasError(error),
      },
      { status: 502 },
    );
  }
}

function safeMapBiomasError(error: unknown) {
  if (isMapBiomasAuthError(error)) {
    return "Nao foi possivel autenticar na API MapBiomas. Verifique as variaveis do servidor.";
  }
  if (isMapBiomasUnavailableError(error)) {
    return "A API MapBiomas nao respondeu agora. Tente novamente mais tarde.";
  }
  return "Nao foi possivel consultar a API MapBiomas Alerta agora.";
}

function extractAlertsArray(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const alerts = (value as Record<string, unknown>).alerts;
  return Array.isArray(alerts) ? alerts : [];
}
