import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { releaseDocumentStorage } from "@/lib/documents/server";
import { assertDocumentStoragePath } from "@/lib/documents/storage";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { documentId?: string };
  if (!body.documentId) {
    return NextResponse.json({ error: "Documento nao informado." }, { status: 400 });
  }

  const { data: document, error: findError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", body.documentId)
    .eq("organization_id", organization.id)
    .eq("upload_status", "aguardando_upload")
    .maybeSingle();
  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!document) return NextResponse.json({ ok: true });

  assertDocumentStoragePath(organization.id, document.storage_path);
  await supabase.storage.from(document.storage_bucket ?? "documentos").remove([document.storage_path]);
  await releaseDocumentStorage(supabase, organization.id, Number(document.size_bytes ?? 0));
  await supabase
    .from("documents")
    .update({
      upload_status: "cancelado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("organization_id", organization.id);

  return NextResponse.json({ ok: true });
}

