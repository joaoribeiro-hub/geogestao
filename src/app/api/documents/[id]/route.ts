import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { removeDocumentStorage } from "@/lib/documents/server";
import { assertDocumentStoragePath } from "@/lib/documents/storage";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(
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
    .eq("organization_id", organization.id)
    .eq("is_global", false)
    .is("deleted_at", null)
    .single();
  if (error || !document) {
    return NextResponse.json({ error: error?.message ?? "Documento nao encontrado." }, { status: 404 });
  }

  assertDocumentStoragePath(organization.id, document.storage_path);
  await supabase.storage.from(document.storage_bucket ?? "documentos").remove([document.storage_path]);

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      deleted_at: new Date().toISOString(),
      upload_status: "removido",
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("organization_id", organization.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await removeDocumentStorage(supabase, organization.id, Number(document.size_bytes ?? 0));
  return NextResponse.json({ ok: true });
}

