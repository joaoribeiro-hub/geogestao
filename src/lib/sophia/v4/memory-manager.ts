import type { SophiaContext } from "@/lib/sophia/types";
import { sanitizeSophiaGlobalTemplate } from "@/lib/sophia/v4/privacy-sanitizer";

export type SophiaV4MemoryType = "semantic" | "episodic" | "procedural" | "operational" | "reflection" | "preference" | "organization_rule";
export type SophiaV4MemoryScope = "user" | "organization" | "global_template";

export async function persistSophiaV4Memory(input: {
  context: SophiaContext;
  type: SophiaV4MemoryType;
  scope: SophiaV4MemoryScope;
  title: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  const database = input.context.supabase as unknown as MemoryDatabase;
  const content = input.scope === "global_template" ? sanitizeSophiaGlobalTemplate(input.content) : input.content;
  const { data, error } = await database.from("sophia_memories").insert({
    organization_id: input.context.organizationId,
    user_id: input.scope === "user" ? input.context.user.id : null,
    scope: input.scope,
    title: input.title.slice(0, 240),
    content: content.slice(0, 12000),
    memory_type: input.type,
    metadata: input.metadata ?? {},
    source: input.source ?? "sophia_v4",
    created_by: input.context.user.id,
  }).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function retrieveSophiaV4Memories(context: SophiaContext, query: string, limit = 12) {
  const database = context.supabase as unknown as MemoryDatabase;
  const globalDatabase = context.supabase as unknown as GlobalRuleDatabase;
  const safe = query.replace(/[%_,()]/g, " ").trim();
  let request = database.from("sophia_memories").select("id,scope,title,content,memory_type,metadata,importance,updated_at").eq("organization_id", context.organizationId).is("deleted_at", null).order("importance", { ascending: false }).limit(limit);
  if (safe) request = request.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`);
  const [{ data, error }, globalRules] = await Promise.all([
    request,
    globalDatabase.from("platform_sophia_rules").select("id,rule_key,sanitized_content,evidence_count,updated_at").eq("status", "active").order("updated_at", { ascending: false }).limit(5),
  ]);
  const universal = (globalRules.data ?? []).map((rule) => ({
    id: rule.id,
    scope: "global_template",
    title: rule.rule_key,
    content: rule.sanitized_content,
    memory_type: "procedural",
    metadata: { evidence_count: rule.evidence_count },
    importance: 5,
    updated_at: rule.updated_at,
  }));
  if (error) return universal;
  return [...universal, ...(data ?? [])].slice(0, limit);
}

type MemoryQuery = PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & {
  eq(column: string, value: string): MemoryQuery;
  is(column: string, value: null): MemoryQuery;
  or(value: string): MemoryQuery;
  order(column: string, options: { ascending: boolean }): MemoryQuery;
  limit(value: number): MemoryQuery;
};
type MemoryTable = {
  select(columns: string): MemoryQuery;
  insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: { id?: string } | null; error: { message: string } | null }> } };
};
type MemoryDatabase = { from(table: string): MemoryTable };
type GlobalRuleQuery = PromiseLike<{ data: Array<{ id: string; rule_key: string; sanitized_content: string; evidence_count: number; updated_at: string }> | null; error: { message: string } | null }> & {
  eq(column: string, value: string): GlobalRuleQuery;
  order(column: string, options: { ascending: boolean }): GlobalRuleQuery;
  limit(value: number): GlobalRuleQuery;
};
type GlobalRuleDatabase = { from(table: "platform_sophia_rules"): { select(columns: string): GlobalRuleQuery } };
