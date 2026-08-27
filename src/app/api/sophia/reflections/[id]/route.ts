import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({ status: z.enum(["approved", "rejected"]), notes: z.string().trim().max(1000).optional().nullable() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || membership?.role !== "owner") return NextResponse.json({ error: "Apenas o owner pode revisar aprendizados." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  const { id } = await params;
  const db = supabase as unknown as CandidateSupabase;
  const candidate = await db.from("sophia_rule_candidates").select("id,rule_key,evidence_count,examples,status").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (candidate.error || !candidate.data) return NextResponse.json({ error: "Regra candidata nao encontrada." }, { status: 404 });
  if (parsed.data.status === "approved") {
    const memory = await db.from("sophia_memories").insert({
      organization_id: organization.id,
      user_id: user.id,
      scope: "organization",
      memory_type: "organization_rule",
      title: `Regra aprovada: ${candidate.data.rule_key}`,
      content: `Regra operacional aprovada pelo owner apos ${candidate.data.evidence_count} evidencia(s).`,
      metadata: { rule_key: candidate.data.rule_key, examples: candidate.data.examples ?? [] },
      importance: 4,
      source: "sophia_reflection_approval",
      created_by: user.id,
    });
    if (memory.error) return NextResponse.json({ error: memory.error.message }, { status: 500 });
  }
  const approval = await db.from("sophia_rule_approvals").upsert({
    organization_id: organization.id,
    rule_candidate_id: candidate.data.id,
    approved_by: user.id,
    status: parsed.data.status,
    notes: parsed.data.notes ?? null,
  }, { onConflict: "organization_id,rule_candidate_id" });
  if (approval.error) return NextResponse.json({ error: approval.error.message }, { status: 500 });
  const updated = await db.from("sophia_rule_candidates").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organization.id);
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: parsed.data.status });
}

type CandidateRow = { id: string; rule_key: string; evidence_count: number; examples?: unknown; status: string };
type CandidateChain = PromiseLike<{ data: CandidateRow | null; error: { message: string } | null }> & { eq(column: string, value: string): CandidateChain; maybeSingle(): Promise<{ data: CandidateRow | null; error: { message: string } | null }> };
type CandidateTable = { select(columns: string): CandidateChain; insert(value: Record<string, unknown>): Promise<{ error: { message: string } | null }>; upsert(value: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: { message: string } | null }>; update(value: Record<string, unknown>): { eq(column: string, value: string): { eq(column: string, value: string): Promise<{ error: { message: string } | null }> } } };
type CandidateSupabase = { from(table: string): CandidateTable };
