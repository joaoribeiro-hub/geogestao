import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { confirmDocumentStorage } from "@/lib/documents/server";
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
    .single();
  if (findError || !document) {
    return NextResponse.json({ error: findError?.message ?? "Documento nao encontrado." }, { status: 404 });
  }

  assertDocumentStoragePath(organization.id, document.storage_path);

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      upload_status: "enviado",
      processing_status: "pendente",
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("organization_id", organization.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await confirmDocumentStorage(supabase, organization.id, Number(document.size_bytes ?? 0));

  await supabase.from("document_processing_jobs").insert({
    document_id: document.id,
    organization_id: organization.id,
    status: "pending",
    payload: {
      document_id: document.id,
      organization_id: organization.id,
      storage_bucket: document.storage_bucket,
      storage_path: document.storage_path,
      mime_type: document.mime_type,
      attempt: 0,
    },
  });

  return NextResponse.json({ ok: true, documentId: document.id });
}

