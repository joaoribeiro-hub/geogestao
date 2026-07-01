import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUploadedText } from "@/lib/modules/shared-text";
import { parseRtkText } from "@/lib/modules/rtk-ppp/converter";
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
    return NextResponse.json({ error: "Envie um arquivo TXT." }, { status: 400 });
  }

  const { text, encoding } = await readUploadedText(file);
  const parsed = parseRtkText(text, encoding);
  return NextResponse.json(parsed);
}
