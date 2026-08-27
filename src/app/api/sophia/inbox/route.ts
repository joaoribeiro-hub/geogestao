import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  DOCUMENTS_BUCKET,
  sanitizeDocumentFileName,
  validateDocumentFile,
} from "@/lib/documents/storage";
import { enqueueSophiaDocumentIngestionJob } from "@/lib/sophia/v3/document-ingestion";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });

  const { data, error } = await (supabase as unknown as UntypedSupabase)
    .from("sophia_inbox_items")
    .select("id,original_name,mime_type,size_bytes,status,classification,confidence,suggested_entity_type,document_id,error_message,created_at,updated_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const source = formData?.get("source")?.toString() === "sophia_chat" ? "sophia_chat" : "sophia_inbox";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo para a caixa de entrada da Sophia." }, { status: 400 });
  }
  const validation = validateDocumentFile({ sizeBytes: file.size, mimeType: file.type });
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });

  const inboxId = crypto.randomUUID();
  const safeName = sanitizeDocumentFileName(file.name);
  const storagePath = `organizations/${organization.id}/sophia-inbox/${inboxId}/${safeName}`;
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const classification = classifyInboxFile(file.name, file.type);
  const { data, error } = await (supabase as unknown as UntypedSupabase)
    .from("sophia_inbox_items")
    .insert({
      id: inboxId,
      organization_id: organization.id,
      user_id: user.id,
      storage_bucket: DOCUMENTS_BUCKET,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      status: "needs_processing",
      classification,
      confidence: classification.confidence,
      suggested_entity_type: classification.entityType,
    })
    .select("id,original_name,status,classification,confidence,created_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    await enqueueSophiaDocumentIngestionJob({
      supabase,
      organizationId: organization.id,
      userId: user.id,
      inboxItemId: inboxId,
      storageBucket: DOCUMENTS_BUCKET,
      storagePath,
      fileName: file.name,
      mimeType: file.type,
    });
  } catch (queueError) {
    if (process.env.NODE_ENV !== "production") console.warn("[sophia:ingestion] fila indisponivel", queueError);
  }
  return NextResponse.json({
    item: data,
    attachment: source === "sophia_chat" ? {
      inboxItemId: inboxId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      source,
    } : undefined,
  });
}

function classifyInboxFile(name: string, mimeType: string) {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const entityType = /\b(contrato|proposta|servico|protocolo)\b/.test(normalized)
    ? "service"
    : /\b(cliente|cpf|cnpj)\b/.test(normalized)
      ? "client"
      : /\b(colaborador|rh|ferias|holerite)\b/.test(normalized)
        ? "employee"
        : "company";
  const documentType = /\b(matricula)\b/.test(normalized)
    ? "matricula"
    : /\b(contrato)\b/.test(normalized)
      ? "contrato"
      : /\b(proposta)\b/.test(normalized)
        ? "proposta"
        : "documento";
  return {
    entityType,
    documentType,
    mimeType,
    confidence: entityType === "company" ? 0.45 : 0.7,
    reason: "classificacao_inicial_por_nome_e_mime",
  };
}

type UntypedSupabase = {
  from(table: string): {
    select(columns: string): UntypedQuery;
    insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> } };
  };
};

type UntypedQuery = {
  eq(column: string, value: string): UntypedQuery;
  order(column: string, options: { ascending: boolean }): UntypedQuery;
  limit(count: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
};
