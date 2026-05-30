import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  downloadGoogleDriveFile,
  getFreshGoogleAccessToken,
  getGoogleIntegrationForUser,
} from "@/lib/integrations/google";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "Documento nao informado." }, { status: 400 });

  const { data: document, error } = await supabase
    .from("documents")
    .select("id,organization_id,original_name,mime_type,storage_provider,google_drive_file_id,google_drive_owner_user_id,deleted_at")
    .eq("id", documentId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !document) {
    return NextResponse.json({ error: error?.message ?? "Documento nao encontrado." }, { status: 404 });
  }
  if (document.storage_provider !== "google_drive" || !document.google_drive_file_id || !document.google_drive_owner_user_id) {
    return NextResponse.json({ error: "Documento nao esta no Google Drive." }, { status: 400 });
  }

  const integration = await getGoogleIntegrationForUser({
    supabase,
    userId: document.google_drive_owner_user_id,
    organizationId: organization.id,
    provider: "google_drive",
  });
  if (!integration || integration.status !== "active") {
    return NextResponse.json({ error: "Drive do dono do arquivo precisa ser reconectado." }, { status: 409 });
  }

  try {
    const accessToken = await getFreshGoogleAccessToken(supabase, integration);
    const { response, metadata } = await downloadGoogleDriveFile(accessToken, document.google_drive_file_id);
    return new Response(response.body, {
      headers: {
        "content-type": metadata.mimeType ?? document.mime_type ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${encodeURIComponent(metadata.name ?? document.original_name)}"`,
      },
    });
  } catch (downloadError) {
    return NextResponse.json(
      { error: downloadError instanceof Error ? downloadError.message : "Nao foi possivel baixar do Google Drive." },
      { status: 500 },
    );
  }
}
