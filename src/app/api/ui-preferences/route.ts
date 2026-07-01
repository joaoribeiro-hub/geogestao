import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

const preferenceSchema = z.object({
  fontScale: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  palette: z.string().optional(),
});

type PreferencesClient = {
  from: (table: "user_preferences" | "user_ui_preferences") => {
    select: (columns: string) => {
      eq: (column: "user_id", value: string) => {
        maybeSingle: () => Promise<{
          data: {
            font_scale: string | number | null;
            theme_mode?: string | null;
            palette_key?: string | null;
            dark_mode: boolean | null;
            color_palette: string | null;
          } | null;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: "user_id" },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const preferencesClient = supabase as unknown as PreferencesClient;
  const table = preferencesClient.from("user_preferences");
  const { data, error } = await table
    .select("font_scale,theme_mode,palette_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && isMissingPreferencesTable(error.message)) {
    return loadLegacyPreferences(preferencesClient, user.id);
  }
  if (error) {
    return NextResponse.json({ error: "Nao foi possivel carregar preferencias." }, { status: 500 });
  }

  return NextResponse.json({
    fontScale: data?.font_scale ?? null,
    theme: data?.theme_mode === "dark" ? "dark" : "light",
    palette: data?.palette_key ?? null,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const body = await request.json().catch(() => null);
  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Preferencias invalidas." }, { status: 400 });
  }

  const preferencesClient = supabase as unknown as PreferencesClient;
  const table = preferencesClient.from("user_preferences");
  const { error } = await table.upsert(
    {
      user_id: user.id,
      font_scale: normalizeFontScale(parsed.data.fontScale),
      theme_mode: parsed.data.theme ?? "light",
      palette_key: parsed.data.palette ?? "agrimensura_verde",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error && isMissingPreferencesTable(error.message)) {
    return saveLegacyPreferences(preferencesClient, {
      userId: user.id,
      fontScale: normalizeFontScale(parsed.data.fontScale),
      theme: parsed.data.theme ?? "light",
      palette: parsed.data.palette ?? "agrimensura_verde",
    });
  }
  if (error) {
    return NextResponse.json({ error: "Nao foi possivel salvar preferencias." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, persisted: true });
}

function isMissingPreferencesTable(message: string) {
  return /user_preferences|user_ui_preferences/i.test(message) &&
    (/does not exist/i.test(message) || /schema cache/i.test(message));
}

async function loadLegacyPreferences(preferencesClient: PreferencesClient, userId: string) {
  const legacyTable = preferencesClient.from("user_ui_preferences");
  const { data, error } = await legacyTable
    .select("font_scale,dark_mode,color_palette")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isMissingPreferencesTable(error.message)) {
    return NextResponse.json({
      fontScale: "1.2",
      theme: "light",
      palette: "agrimensura_verde",
    });
  }
  if (error) {
    return NextResponse.json({ error: "Nao foi possivel carregar preferencias." }, { status: 500 });
  }

  return NextResponse.json({
    fontScale: normalizeFontScale(data?.font_scale),
    theme: data?.dark_mode ? "dark" : "light",
    palette: data?.color_palette ?? "agrimensura_verde",
  });
}

async function saveLegacyPreferences(
  preferencesClient: PreferencesClient,
  payload: {
    userId: string;
    fontScale: string;
    theme: "light" | "dark";
    palette: string;
  },
) {
  const legacyTable = preferencesClient.from("user_ui_preferences");
  const { error } = await legacyTable.upsert(
    {
      user_id: payload.userId,
      font_scale: payload.fontScale,
      dark_mode: payload.theme === "dark",
      color_palette: payload.palette,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error && isMissingPreferencesTable(error.message)) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  if (error) {
    return NextResponse.json({ error: "Nao foi possivel salvar preferencias." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, persisted: true, legacy: true });
}

function normalizeFontScale(value: string | number | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value ?? "1.2").replace(",", ".").replace("x", ""));
  if (!Number.isFinite(parsed)) return "1.2";
  const clamped = Math.min(1.75, Math.max(0.6, parsed));
  return String(Math.round(clamped * 20) / 20);
}
