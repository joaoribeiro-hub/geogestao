import type { Json } from "@/types/database";
import type { SophiaContext } from "@/lib/sophia/types";

export type DocumentEvidence = {
  chunkId: string;
  documentId: string;
  document: string;
  page: number | null;
  snippet: string;
  source: string;
  relevance: number;
};

export async function retrieveDocumentEvidence(context: SophiaContext, input: { query?: string; documentId?: string | null; limit?: number }) {
  const term = String(input.query ?? "").trim();
  const db = context.supabase as unknown as DocumentSupabase;
  let query = db.from("document_chunks")
    .select("id,document_id,page,page_start,page_end,text,content,source")
    .eq("organization_id", context.organizationId)
    .limit(input.limit ?? 16);
  if (input.documentId) query = query.eq("document_id", input.documentId);
  if (term) {
    const safe = term.replace(/[%_,()]/g, " ").trim();
    try {
      query = query.textSearch("content_tsv", safe, { type: "websearch", config: "simple" });
    } catch {
      query = query.or(`text.ilike.%${safe}%,content.ilike.%${safe}%`);
    }
  }
  let result = await query;
  if (result.error && term) {
    const safe = term.replace(/[%_,()]/g, " ").trim();
    result = await db.from("document_chunks")
      .select("id,document_id,page,page_start,page_end,text,content,source")
      .eq("organization_id", context.organizationId)
      .or(`text.ilike.%${safe}%,content.ilike.%${safe}%`)
      .limit(input.limit ?? 16);
  }
  if (result.error) throw new Error(result.error.message);
  const rows = result.data ?? [];
  const documents = await loadDocumentNames(context, rows.map((row) => row.document_id));
  const terms = tokenize(term);
  return rows
    .map((row) => {
      const snippet = String(row.content ?? row.text ?? "");
      return {
        chunkId: row.id,
        documentId: row.document_id,
        document: documents.get(row.document_id) ?? "Documento",
        page: row.page_start ?? row.page ?? null,
        snippet: snippet.slice(0, 900),
        source: row.source ?? "documento",
        relevance: lexicalRelevance(snippet, terms),
      } satisfies DocumentEvidence;
    })
    .filter((item) => !terms.length || item.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance);
}

export function answerFromEvidence(evidence: DocumentEvidence[]) {
  if (!evidence.length) {
    return { answer: "Nao encontrei evidencia suficiente nos documentos da organizacao atual para responder com seguranca.", citations: [] as Json };
  }
  const answer = evidence.slice(0, 3).map((item) => `${item.snippet} [${item.document}${item.page ? `, pagina ${item.page}` : ""}, chunk ${item.chunkId}]`).join("\n\n");
  return {
    answer,
    citations: evidence.slice(0, 8) as unknown as Json,
  };
}

async function loadDocumentNames(context: SophiaContext, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await context.supabase.from("documents").select("id,title,original_name").in("id", unique).eq("organization_id", context.organizationId);
  return new Map((data ?? []).map((row) => [row.id, row.title ?? row.original_name ?? "Documento"]));
}

function tokenize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^\w]+/).filter((term) => term.length >= 3).slice(0, 12);
}

function lexicalRelevance(text: string, terms: string[]) {
  if (!terms.length) return 1;
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return terms.filter((term) => normalized.includes(term)).length / terms.length;
}

type DocumentRow = { id: string; document_id: string; page?: number | null; page_start?: number | null; text?: string | null; content?: string | null; source?: string | null };
type DocumentQuery = PromiseLike<{ data: DocumentRow[] | null; error: { message: string } | null }> & {
  eq(column: string, value: string): DocumentQuery;
  or(value: string): DocumentQuery;
  limit(value: number): DocumentQuery;
  textSearch(column: string, value: string, options: { type: string; config: string }): DocumentQuery;
};
type DocumentSupabase = { from(table: string): { select(columns: string): DocumentQuery } };

