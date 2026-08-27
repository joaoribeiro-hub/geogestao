import type { ServerSupabase } from "@/lib/sophia/types";
import { callWorkerWithRetry } from "@/lib/workers/worker-client";

export async function triggerSophiaDocumentIngestion(input: {
  supabase: ServerSupabase;
  organizationId: string;
  userId: string;
  inboxItemId?: string | null;
  documentId?: string | null;
}) {
  const db = input.supabase as unknown as IngestionSupabase;
  const sourceType = input.inboxItemId ? "inbox" : "document";
  const sourceId = input.inboxItemId ?? input.documentId;
  if (!sourceId) throw new Error("Informe inbox_item_id ou document_id.");

  const sourceQuery = sourceType === "inbox"
    ? db.from("sophia_inbox_items").select("id,organization_id,user_id,document_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,status").eq("id", sourceId).eq("organization_id", input.organizationId).maybeSingle()
    : db.from("documents").select("id,organization_id,uploaded_by,storage_bucket,storage_path,original_name,mime_type,size_bytes,upload_status").eq("id", sourceId).eq("organization_id", input.organizationId).maybeSingle();
  const { data: source, error: sourceError } = await sourceQuery;
  if (sourceError || !source) throw new Error("Documento nao encontrado na organizacao atual.");
  if (sourceType === "inbox" && source.user_id !== input.userId) throw new Error("Documento nao pertence ao usuario atual.");

  const existing = await db.from("sophia_document_ingestion_jobs").select("id,status").eq("organization_id", input.organizationId).eq(sourceType === "inbox" ? "inbox_item_id" : "document_id", sourceId).in("status", ["pending", "processing"]).limit(1).maybeSingle();
  let jobId = existing.data?.id ?? null;
  if (!jobId) {
    const created = await db.from("sophia_document_ingestion_jobs").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      document_id: source.document_id ?? (sourceType === "document" ? source.id : null),
      inbox_item_id: sourceType === "inbox" ? source.id : null,
      storage_bucket: source.storage_bucket ?? "documentos",
      storage_path: source.storage_path,
      file_name: source.original_name,
      mime_type: source.mime_type,
      status: "pending",
      progress: 0,
    }).select("id").maybeSingle();
    if (created.error) throw new Error(created.error.message);
    jobId = created.data?.id ?? null;
  }

  const workerUrl = process.env.SOPHIA_DOCUMENT_WORKER_URL?.replace(/\/$/, "");
  const workerSecret = process.env.SOPHIA_DOCUMENT_WORKER_SECRET;
  if (!workerUrl || !workerSecret) throw new Error("Leitura documental nao configurada no servidor.");
  const path = sourceType === "inbox" ? `/inbox/${source.id}/ingest` : `/documents/${source.id}/ingest`;
  const worker = await callWorkerWithRetry({ url: workerUrl, secret: workerSecret, path, method: "POST" });
  const body = worker.data;
  if (!worker.ok) {
    const errorMessage = typeof body?.detail === "string"
      ? body.detail
      : worker.message ?? "Worker documental indisponivel.";
    await db.from("sophia_document_ingestion_jobs").update({ status: "failed", progress: 100, error_message: errorMessage }).eq("id", jobId ?? "");
    throw new Error(errorMessage);
  }
  await db.from("sophia_document_ingestion_jobs").update({ status: "processing", progress: 5, error_message: null }).eq("id", jobId ?? "");
  return { jobId, body, workerStatus: worker.workerStatus };
}

export async function enqueueSophiaDocumentIngestionJob(input: {
  supabase: ServerSupabase;
  organizationId: string;
  userId: string;
  inboxItemId: string;
  documentId?: string | null;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
}) {
  const db = input.supabase as unknown as IngestionSupabase;
  const { data, error } = await db.from("sophia_document_ingestion_jobs").insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    document_id: input.documentId ?? null,
    inbox_item_id: input.inboxItemId,
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    status: "pending",
    progress: 0,
  }).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

type IngestionRow = { id: string; organization_id: string; user_id?: string; document_id?: string | null; uploaded_by?: string | null; storage_bucket?: string | null; storage_path: string; original_name: string; mime_type?: string | null; size_bytes?: number | null; status?: string };
type IngestionChain = PromiseLike<{ data: IngestionRow | null; error: { message: string } | null }> & {
  eq(column: string, value: string): IngestionChain;
  in(column: string, values: string[]): IngestionChain;
  limit(value: number): IngestionChain;
  maybeSingle(): Promise<{ data: IngestionRow | null; error: { message: string } | null }>;
};
type IngestionTable = {
  select(columns: string): IngestionChain;
  insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: { id?: string } | null; error: { message: string } | null }> } };
  update(value: Record<string, unknown>): { eq(column: string, value: string): Promise<{ error: { message: string } | null }> };
};
type IngestionSupabase = { from(table: string): IngestionTable };
