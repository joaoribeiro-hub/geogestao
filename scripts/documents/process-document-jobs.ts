import { createClient } from "@supabase/supabase-js";
import { extractTextFromDocument } from "@/lib/documents/processing";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY apenas no ambiente server/admin.");
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  const { data: jobs, error } = await supabase
    .from("document_processing_jobs")
    .select("*, documents(*)")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);

  for (const job of jobs ?? []) {
    await supabase
      .from("document_processing_jobs")
      .update({ status: "processing", locked_at: new Date().toISOString(), attempts: job.attempts + 1 })
      .eq("id", job.id);

    const document = Array.isArray(job.documents) ? job.documents[0] : job.documents;
    if (!document) continue;

    try {
      const { data, error: downloadError } = await supabase.storage
        .from(document.storage_bucket)
        .download(document.storage_path);
      if (downloadError) throw new Error(downloadError.message);

      const buffer = Buffer.from(await data.arrayBuffer());
      const outcome = await extractTextFromDocument({
        buffer,
        mimeType: document.mime_type,
        filename: document.original_name,
      });

      await supabase.from("document_chunks").delete().eq("document_id", document.id);
      if (outcome.chunks.length) {
        await supabase.from("document_chunks").insert(
          outcome.chunks.map((chunk) => ({
            document_id: document.id,
            organization_id: document.organization_id!,
            page: chunk.page ?? null,
            chunk_index: chunk.chunkIndex,
            text: chunk.text,
            source: chunk.source,
          })),
        );
      }

      await supabase
        .from("documents")
        .update({
          processing_status: outcome.status,
          extracted_text: outcome.extractedText,
          processing_error: "reason" in outcome ? outcome.reason : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", document.id);

      await supabase
        .from("document_processing_jobs")
        .update({ status: "done", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", job.id);
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : "Erro desconhecido";
      await supabase
        .from("documents")
        .update({ processing_status: "erro", processing_error: message, updated_at: new Date().toISOString() })
        .eq("id", document.id);
      await supabase
        .from("document_processing_jobs")
        .update({ status: "error", last_error: message, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    }
  }
}

void main();

