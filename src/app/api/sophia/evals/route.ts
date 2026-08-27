import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAvailableSophiaTools } from "@/lib/sophia/permissions";
import { runSophiaEvalCase, SOPHIA_V4_DEFAULT_EVAL_CASES } from "@/lib/sophia/v4/evals";

const postSchema = z.object({ caseId: z.string().uuid() });

export async function GET() {
  const access = await requireEvalAccess();
  if (access.response) return access.response;
  const { supabase, organization, user } = access;
  const db = supabase as unknown as EvalDatabase;
  await ensureDefaultCases(db, organization.id);
  const [cases, runs] = await Promise.all([
    db.from("sophia_eval_cases").select("id,eval_key,title,input_text,expected_behavior,expected_tool,expected_skill,active,created_at").eq("organization_id", organization.id).order("created_at", { ascending: true }).limit(100),
    db.from("sophia_eval_runs").select("id,eval_case_id,status,result,score,created_at,finished_at").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (cases.error || runs.error) return NextResponse.json({ error: cases.error?.message ?? runs.error?.message }, { status: 500 });
  return NextResponse.json({ cases: cases.data ?? [], runs: runs.data ?? [], userId: user.id });
}

export async function POST(request: Request) {
  const access = await requireEvalAccess();
  if (access.response) return access.response;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Caso de avaliacao invalido." }, { status: 400 });
  const { supabase, organization, membership, user } = access;
  const db = supabase as unknown as EvalDatabase;
  const selected = await db.from("sophia_eval_cases").select("id,title,input_text,expected_tool,expected_skill").eq("id", parsed.data.caseId).eq("organization_id", organization.id).maybeSingle();
  if (selected.error || !selected.data) return NextResponse.json({ error: "Caso nao encontrado." }, { status: 404 });
  const toolAvailability = await getAvailableSophiaTools({ supabase, organizationId: organization.id, user, membership, isOwner: membership.role === "owner" });
  const result = await runSophiaEvalCase({
    title: String(selected.data.title),
    input: String(selected.data.input_text),
    expectedTool: typeof selected.data.expected_tool === "string" ? selected.data.expected_tool : null,
    expectedSkill: typeof selected.data.expected_skill === "string" ? selected.data.expected_skill : null,
    role: membership.role,
  }, toolAvailability.filter((item) => item.status === "available").map((item) => item.tool));
  const inserted = await db.from("sophia_eval_runs").insert({
    organization_id: organization.id,
    eval_case_id: selected.data.id,
    status: "completed",
    result: { tool: result.state.selected_tool, skill: result.state.selected_skill, errors: result.state.errors, trace: result.state.trace },
    score: result.score,
    finished_at: new Date().toISOString(),
  }).select("id,eval_case_id,status,result,score,created_at,finished_at").maybeSingle();
  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 });
  return NextResponse.json({ run: inserted.data });
}

async function requireEvalAccess() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership || !["owner", "admin"].includes(membership.role)) {
    return { response: NextResponse.json({ error: "Apenas owner ou admin tecnico pode acessar avaliacoes." }, { status: 403 }) } as const;
  }
  return { response: null, supabase, user, organization, membership } as const;
}

async function ensureDefaultCases(db: EvalDatabase, organizationId: string) {
  await Promise.all(SOPHIA_V4_DEFAULT_EVAL_CASES.map((item) => db.from("sophia_eval_cases").upsert({
    organization_id: organizationId,
    eval_key: item.key,
    title: item.title,
    input_text: item.input,
    expected_behavior: `Selecionar ${item.expectedSkill ?? "resposta segura"} e respeitar permissoes.`,
    expected_tool: item.expectedTool,
    expected_skill: item.expectedSkill,
    scope: "organization",
    active: true,
  }, { onConflict: "organization_id,eval_key" })));
}

type Query = PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & {
  eq(column: string, value: string): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(value: number): Query;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};
type EvalTable = {
  select(columns: string): Query;
  insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
  upsert(value: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: { message: string } | null }>;
};
type EvalDatabase = { from(table: string): EvalTable };
