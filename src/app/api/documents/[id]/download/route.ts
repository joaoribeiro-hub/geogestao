import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertDocumentStoragePath } from "@/lib/documents/storage";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .or(`organization_id.eq.${organization.id},is_global.eq.true`)
    .is("deleted_at", null)
    .single();
  if (error || !document) {
    return NextResponse.json({ error: error?.message ?? "Documento nao encontrado." }, { status: 404 });
  }

  if (!document.is_global) {
    assertDocumentStoragePath(organization.id, document.storage_path);
  }

  const { data, error: signedError } = await supabase.storage
    .from(document.storage_bucket ?? "documentos")
    .createSignedUrl(document.storage_path, 60 * 5);
  if (signedError) {
    return NextResponse.json({ error: signedError.message }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, expiresInSeconds: 300 });
}

