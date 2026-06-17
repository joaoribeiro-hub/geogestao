import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

const preferenceSchema = z.object({
  fontScale: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  palette: z.string().optional(),
});

type UserUiPreferencesClient = {
  from: (table: "user_ui_preferences") => {
    select: (columns: string) => {
      eq: (column: "user_id", value: string) => {
        maybeSingle: () => Promise<{
          data: {
            font_scale: string | null;
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
  const table = (supabase as unknown as UserUiPreferencesClient).from("user_ui_preferences");
  const { data, error } = await table
    .select("font_scale,dark_mode,color_palette")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && isMissingPreferencesTable(error.message)) {
    return NextResponse.json({});
  }
  if (error) {
    return NextResponse.json({ error: "Nao foi possivel carregar preferencias." }, { status: 500 });
  }

  return NextResponse.json({
    fontScale: data?.font_scale ?? null,
    theme: data?.dark_mode ? "dark" : "light",
    palette: data?.color_palette ?? null,
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

  const table = (supabase as unknown as UserUiPreferencesClient).from("user_ui_preferences");
  const { error } = await table.upsert(
    {
      user_id: user.id,
      font_scale: parsed.data.fontScale ?? "1",
      dark_mode: parsed.data.theme === "dark",
      color_palette: parsed.data.palette ?? "agrimensura_verde",
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
  return NextResponse.json({ ok: true, persisted: true });
}

function isMissingPreferencesTable(message: string) {
  return /user_ui_preferences/i.test(message) &&
    (/does not exist/i.test(message) || /schema cache/i.test(message));
}
