import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { provider?: string } | null;
  const provider = body?.provider;
  if (provider !== "google_drive" && provider !== "google_calendar") {
    return NextResponse.json({ error: "Integracao Google invalida." }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_integrations")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
