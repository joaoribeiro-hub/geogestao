import type { Json } from "@/types/database";
import type { SophiaContext, SophiaRequestContext } from "@/lib/sophia/types";

export type SophiaMemoryType = "semantic" | "episodic" | "procedural" | "operational";

export async function retrieveSophiaMemories(
  context: SophiaContext,
  requestContext: SophiaRequestContext,
  queryText: string,
  limit = 8,
) {
  const db = context.supabase as unknown as MemorySupabase;
  let query = db.from("sophia_memories")
    .select("id,user_id,scope,scope_id,memory_type,title,content,importance,metadata,updated_at")
    .eq("organization_id", context.organizationId)
    .is("deleted_at", null)
    .order("importance", { ascending: false })
    .limit(limit * 3);
  if (requestContext.entityId) query = query.or(`scope_id.eq.${requestContext.entityId},scope.eq.company,scope.eq.operational`);
  else query = query.in("scope", ["company", "operational", "user"]);
  const { data, error } = await query;
  if (error) return [];
  const terms = importantTerms(queryText);
  return (data ?? [])
    .filter((memory) => memory.scope !== "user" || memory.user_id === context.user.id)
    .filter((memory) => !terms.length || terms.some((term) => `${memory.title ?? ""} ${memory.content ?? ""}`.toLowerCase().includes(term)))
    .slice(0, limit);
}

export async function persistSophiaMemory(input: {
  context: SophiaContext;
  title: string;
  content: string;
  memoryType: SophiaMemoryType;
  scope?: "user" | "company" | "document" | "service" | "client";
  scopeId?: string | null;
  confirmed: boolean;
  metadata?: Json;
}) {
  if (!input.confirmed) throw new Error("Memoria permanente exige confirmacao humana.");
  const db = input.context.supabase as unknown as MemorySupabase;
  const { data, error } = await db.from("sophia_memories").insert({
    organization_id: input.context.organizationId,
    user_id: input.context.user.id,
    scope: input.scope ?? "user",
    scope_id: input.scopeId ?? null,
    memory_type: input.memoryType,
    title: input.title.trim().slice(0, 180),
    content: input.content.trim().slice(0, 4000),
    metadata: input.metadata ?? {},
    source: "sophia_v3",
    created_by: input.context.user.id,
  }).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

function importantTerms(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^\w]+/).filter((term) => term.length >= 4).slice(0, 8);
}

type MemoryRow = { user_id?: string | null; scope?: string; title?: string; content?: string } & Record<string, unknown>;
type MemoryQuery = PromiseLike<{ data: MemoryRow[] | null; error: { message: string } | null }> & {
  eq(column: string, value: string): MemoryQuery;
  is(column: string, value: null): MemoryQuery;
  order(column: string, options: { ascending: boolean }): MemoryQuery;
  limit(value: number): MemoryQuery;
  or(value: string): MemoryQuery;
  in(column: string, values: string[]): MemoryQuery;
};
type MemorySupabase = {
  from(table: string): {
    select(columns: string): MemoryQuery;
    insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: { id?: string } | null; error: { message: string } | null }> } };
  };
};
