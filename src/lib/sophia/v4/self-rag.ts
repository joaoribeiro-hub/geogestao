import type { SophiaContext } from "@/lib/sophia/types";
import { retrieveDocumentEvidence, type DocumentEvidence } from "@/lib/sophia/v3/self-rag";
import type { SophiaV4Citation } from "@/lib/sophia/v4/state";

export function shouldRetrieveSophiaDocuments(input: string, documentId?: string | null) {
  return Boolean(documentId) || /\b(documento|arquivo|pdf|contrato|matricula|anexo)\b/i.test(input);
}

export async function retrieveSophiaV4Evidence(context: SophiaContext, input: { query: string; documentId?: string | null; limit?: number }) {
  if (!shouldRetrieveSophiaDocuments(input.query, input.documentId)) return [];
  return retrieveDocumentEvidence(context, { query: input.query, documentId: input.documentId, limit: input.limit ?? 16 });
}

export function gradeSophiaEvidence(evidence: DocumentEvidence[]) {
  return evidence.map((item) => ({ ...item, supported: item.relevance >= 0.25 && item.snippet.trim().length >= 20 }));
}

export function answerWithSophiaV4Citations(evidence: DocumentEvidence[]) {
  const supported = gradeSophiaEvidence(evidence).filter((item) => item.supported).slice(0, 5);
  if (!supported.length) {
    return {
      answer: "Nao encontrei evidencia suficiente nos documentos da sua empresa para afirmar isso.",
      citations: [] as SophiaV4Citation[],
      supported: false,
    };
  }
  const citations = supported.map((item) => ({
    document_id: item.documentId,
    document: item.document,
    page: item.page,
    chunk_id: item.chunkId,
    snippet: item.snippet.slice(0, 260),
    source: item.source,
    from_ocr: /ocr/i.test(item.source),
  }));
  return {
    answer: supported.map((item, index) => `${item.snippet.slice(0, 600)} [${index + 1}]`).join("\n\n"),
    citations,
    supported: true,
  };
}
