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
    return NextResponse.json({ error: "Envie um arquivo TXT, PTS ou MC." }, { status: 400 });
  }

  const crs = String(formData.get("crs") ?? "EPSG:31982");
  const { text, encoding } = await readUploadedText(file);
  return NextResponse.json(parseRw5Text(text, { encoding, sourceName: file.name, crs }));
}
