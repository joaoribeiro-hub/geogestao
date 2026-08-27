import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || membership?.role !== "owner") return NextResponse.json({ error: "Apenas o owner pode revisar aprendizados." }, { status: 403 });
  const db = supabase as unknown as ReflectionSupabase;
  const [reflections, candidates] = await Promise.all([
    db.from("sophia_reflections").select("id,failed_intent,user_feedback,corrected_answer,reflection,status,created_at,user_id").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(50),
    db.from("sophia_rule_candidates").select("id,rule_key,evidence_count,examples,status,created_at").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (reflections.error || candidates.error) return NextResponse.json({ error: reflections.error?.message ?? candidates.error?.message }, { status: 500 });
  return NextResponse.json({ reflections: reflections.data ?? [], candidates: candidates.data ?? [] });
}

type ReflectionQuery = PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & { eq(column: string, value: string): ReflectionQuery; order(column: string, options: { ascending: boolean }): ReflectionQuery; limit(value: number): ReflectionQuery };
type ReflectionSupabase = { from(table: string): { select(columns: string): ReflectionQuery } };

