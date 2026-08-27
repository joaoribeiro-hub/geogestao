import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseRw5Text } from "@/lib/modules/rw5/converter";
import { readUploadedText } from "@/lib/modules/shared-text";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  await requireOrganization(supabase, user.id);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo TXT, PTS, MC, CSV ou XLSX." }, { status: 400 });
  }

  const crs = String(formData.get("crs") ?? "EPSG:31982");
  const defaultRoverHr = Number(String(formData.get("defaultRoverHr") ?? "1.700").replace(",", "."));
  const defaultAgeText = String(formData.get("defaultAge") ?? "").trim();
  const defaultAge = defaultAgeText ? Number(defaultAgeText.replace(",", ".")) : null;
  try {
    const { text, encoding } = await readUploadedText(file);
    return NextResponse.json(parseRw5Text(text, {
      encoding,
      sourceName: file.name,
      crs,
      defaultRoverHr: Number.isFinite(defaultRoverHr) ? defaultRoverHr : 1.7,
      defaultAge: Number.isFinite(defaultAge) ? defaultAge : null,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel ler o arquivo." }, { status: 400 });
  }
}
