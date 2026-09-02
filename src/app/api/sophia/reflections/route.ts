import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  try {
    await requirePlatformDeveloper(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }
  const db = supabase as unknown as ReflectionSupabase;
  const candidates = await db.from("sophia_rule_candidates").select("id,rule_key,evidence_count,status,created_at,sanitized_rule,scope").eq("scope", "global_candidate").order("created_at", { ascending: false }).limit(100);
  if (candidates.error) return NextResponse.json({ error: candidates.error.message }, { status: 500 });
  return NextResponse.json({ reflections: [], candidates: candidates.data ?? [], privacy: "Dados locais das empresas nao sao exibidos nesta tela." });
}

type ReflectionQuery = PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & { eq(column: string, value: string): ReflectionQuery; order(column: string, options: { ascending: boolean }): ReflectionQuery; limit(value: number): ReflectionQuery };
type ReflectionSupabase = { from(table: string): { select(columns: string): ReflectionQuery } };
