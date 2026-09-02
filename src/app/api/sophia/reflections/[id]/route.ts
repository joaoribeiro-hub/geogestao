import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requirePlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({ status: z.enum(["approved", "rejected"]), notes: z.string().trim().max(1000).optional().nullable() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  try {
    await requirePlatformDeveloper(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  const { id } = await params;
  const db = supabase as unknown as CandidateSupabase;
  const candidate = await db.from("sophia_rule_candidates").select("id,organization_id,rule_key,evidence_count,status,sanitized_rule,scope").eq("id", id).eq("scope", "global_candidate").maybeSingle();
  if (candidate.error || !candidate.data) return NextResponse.json({ error: "Regra candidata nao encontrada." }, { status: 404 });
  if (parsed.data.status === "approved") {
    const memory = await db.from("platform_sophia_rules").upsert({
      source_candidate_id: candidate.data.id,
      rule_key: candidate.data.rule_key,
      sanitized_content: candidate.data.sanitized_rule ?? "Regra sanitizada sem conteudo disponivel.",
      evidence_count: candidate.data.evidence_count,
      status: "active",
      approved_by: user.id,
    }, { onConflict: "rule_key" });
    if (memory.error) return NextResponse.json({ error: memory.error.message }, { status: 500 });
  }
  const approval = await db.from("sophia_rule_approvals").upsert({
    organization_id: candidate.data.organization_id,
    rule_candidate_id: candidate.data.id,
    approved_by: user.id,
    status: parsed.data.status,
    notes: parsed.data.notes ?? null,
  }, { onConflict: "organization_id,rule_candidate_id" });
  if (approval.error) return NextResponse.json({ error: approval.error.message }, { status: 500 });
  const updated = await db.from("sophia_rule_candidates").update({ status: parsed.data.status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("scope", "global_candidate");
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: parsed.data.status });
}

type CandidateRow = { id: string; organization_id: string; rule_key: string; evidence_count: number; status: string; sanitized_rule?: string | null; scope: string };
type CandidateChain = PromiseLike<{ data: CandidateRow | null; error: { message: string } | null }> & { eq(column: string, value: string): CandidateChain; maybeSingle(): Promise<{ data: CandidateRow | null; error: { message: string } | null }> };
type CandidateTable = { select(columns: string): CandidateChain; insert(value: Record<string, unknown>): Promise<{ error: { message: string } | null }>; upsert(value: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: { message: string } | null }>; update(value: Record<string, unknown>): { eq(column: string, value: string): { eq(column: string, value: string): Promise<{ error: { message: string } | null }> } } };
type CandidateSupabase = { from(table: string): CandidateTable };
