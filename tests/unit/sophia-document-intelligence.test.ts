import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getSophiaToolRegistry, planSophiaToolCall } from "@/lib/sophia/tool-registry";

describe("SOPHIA-DOCUMENT-INTELLIGENCE-OCR-RAG-1", () => {
  it("mantem a migration incremental para paginas, chunks, jobs e busca", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_sophia_document_intelligence.sql"), "utf8");
    expect(migration).toContain("create table if not exists public.document_extracted_pages");
    expect(migration).toContain("create table if not exists public.document_ai_summaries");
    expect(migration).toContain("create table if not exists public.sophia_document_links");
    expect(migration).toContain("match_document_chunks");
    expect(migration).toContain("public.is_org_member");
    expect(migration).toContain("alter column document_id drop not null");
  });

  it("registra tools documentais reais e encaminha perguntas para resposta citavel", () => {
    const ids = getSophiaToolRegistry().map((tool) => tool.id);
    expect(ids).toEqual(expect.arrayContaining(["document_ingest", "document_search", "document_answer", "document_summarize"]));
    expect(planSophiaToolCall("qual matricula aparece no documento?").toolId).toBe("document_answer");
  });

  it("mantem o worker separado e sem chave no frontend", () => {
    const worker = readFileSync(join(process.cwd(), "workers/sophia-documents/app/config.py"), "utf8");
    const route = readFileSync(join(process.cwd(), "src/app/api/sophia/inbox/[id]/process/route.ts"), "utf8");
    const ingestion = readFileSync(join(process.cwd(), "src/lib/sophia/v3/document-ingestion.ts"), "utf8");
    expect(worker).toContain("SOPHIA_DOCUMENT_WORKER_SECRET");
    expect(ingestion).toContain("SOPHIA_DOCUMENT_WORKER_URL");
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("usa o inbox_item_id do anexo e nao entra em confirmacao sem identificador", () => {
    const runner = readFileSync(join(process.cwd(), "src/lib/sophia/runner.ts"), "utf8");
    expect(runner).toContain("attachment_ingest");
    expect(runner).toContain("requestContext.attachments[0].inboxItemId");
    expect(runner).toContain("ownAttachmentIngest");
  });
});
