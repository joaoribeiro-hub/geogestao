import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const { id } = await params;
  const db = supabase as unknown as UntypedSupabase;
  const { data: item, error } = await db.from("sophia_inbox_items")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (error || !item) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 });
  const inboxItem = item as Record<string, unknown>;
  const documentId = typeof inboxItem.document_id === "string" ? inboxItem.document_id : null;
  const document = documentId
    ? (await db.from("documents").select("id,title,original_name,document_type,processing_status,processing_error,extracted_text,pages,created_at,updated_at").eq("id", documentId).eq("organization_id", organization.id).maybeSingle()).data
    : null;
  const chunks = documentId
    ? (await db.from("document_chunks").select("id,page,page_start,page_end,text,content,heading,source,order_index").eq("document_id", documentId).eq("organization_id", organization.id).order("order_index", { ascending: true }).limit(30)).data ?? []
    : [];
  const summary = documentId
    ? (await db.from("document_ai_summaries").select("summary,document_type,entities,risks,next_actions,confidence,provider,created_at").eq("document_id", documentId).eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data
    : null;
  return NextResponse.json({ item, document, chunks, summary });
}

type Chain = PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & {
  eq(column: string, value: string): Chain;
  order(column: string, options: { ascending: boolean }): Chain;
  limit(count: number): Chain;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};
type UntypedSupabase = { from(table: string): { select(columns: string): Chain } };
