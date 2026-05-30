import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildGoogleAuthorizationUrl, createGoogleOAuthState } from "@/lib/integrations/google";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UserIntegrationProvider } from "@/types/database";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  if (!isGoogleProvider(provider)) {
    return NextResponse.json({ error: "Integracao Google invalida." }, { status: 400 });
  }

  try {
    const state = createGoogleOAuthState({
      provider,
      userId: user.id,
      organizationId: organization.id,
    });
    return NextResponse.redirect(buildGoogleAuthorizationUrl({ provider, state }));
  } catch (error) {
    const redirectUrl = new URL("/minha-conta", request.url);
    redirectUrl.searchParams.set("google", "not_configured");
    redirectUrl.searchParams.set("provider", provider);
    if (process.env.NODE_ENV !== "production") {
      console.error("[google-oauth:connect]", error);
    }
    return NextResponse.redirect(redirectUrl);
  }
}

function isGoogleProvider(value: string | null): value is UserIntegrationProvider {
  return value === "google_drive" || value === "google_calendar";
}
