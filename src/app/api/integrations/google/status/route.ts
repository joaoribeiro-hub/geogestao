import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ integrations: [] });

  const { data, error } = await supabase
    .from("user_integrations")
    .select("provider,provider_account_email,status,token_expires_at,updated_at")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .in("provider", ["google_drive", "google_calendar"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    integrations: (data ?? []).map((item) => ({
      provider: item.provider,
      email: item.provider_account_email,
      status: item.status,
      tokenExpiresAt: item.token_expires_at,
      updatedAt: item.updated_at,
    })),
  });
}
