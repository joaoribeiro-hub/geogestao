import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  exchangeGoogleCode,
  fetchGoogleAccountEmail,
  upsertGoogleIntegration,
  verifyGoogleOAuthState,
} from "@/lib/integrations/google";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");
  const redirectUrl = new URL("/minha-conta", requestUrl.origin);

  if (error) {
    redirectUrl.searchParams.set("google", "error");
    redirectUrl.searchParams.set("reason", error);
    return NextResponse.redirect(redirectUrl);
  }
  if (!code || !state) {
    redirectUrl.searchParams.set("google", "error");
    redirectUrl.searchParams.set("reason", "callback_invalido");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    redirectUrl.searchParams.set("google", "error");
    redirectUrl.searchParams.set("reason", "sem_organizacao");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const parsedState = verifyGoogleOAuthState(state);
    if (parsedState.userId !== user.id || parsedState.organizationId !== organization.id) {
      throw new Error("Estado OAuth nao pertence a sessao atual.");
    }
    const token = await exchangeGoogleCode(code);
    const email = await fetchGoogleAccountEmail(token.access_token);
    await upsertGoogleIntegration({
      supabase,
      userId: user.id,
      organizationId: organization.id,
      provider: parsedState.provider,
      token,
      providerAccountEmail: email,
    });
    redirectUrl.searchParams.set("google", "connected");
    redirectUrl.searchParams.set("provider", parsedState.provider);
  } catch (callbackError) {
    redirectUrl.searchParams.set("google", "error");
    redirectUrl.searchParams.set(
      "reason",
      callbackError instanceof Error ? callbackError.message : "falha_google",
    );
  }

  return NextResponse.redirect(redirectUrl);
}
