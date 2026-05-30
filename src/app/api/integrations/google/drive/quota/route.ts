import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getFreshGoogleAccessToken,
  getGoogleDriveQuota,
  getGoogleIntegrationForUser,
} from "@/lib/integrations/google";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ connected: false });
  const integration = await getGoogleIntegrationForUser({
    supabase,
    userId: user.id,
    organizationId: organization.id,
    provider: "google_drive",
  });
  if (!integration || integration.status !== "active") {
    return NextResponse.json({ connected: false });
  }

  try {
    const accessToken = await getFreshGoogleAccessToken(supabase, integration);
    const quota = await getGoogleDriveQuota(accessToken);
    return NextResponse.json({ connected: true, quota });
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : "Falha ao consultar quota." },
      { status: 500 },
    );
  }
}
