import type { ServerSupabase } from "@/lib/sophia/types";

export async function recordSophiaReflection(input: {
  supabase: ServerSupabase;
  organizationId: string;
  userId: string;
  runId?: string | null;
  messageId?: string | null;
  originalAnswer: string;
  userFeedback: string;
  correctedAnswer?: string | null;
  failedIntent?: string | null;
  threshold?: number;
}) {
  const db = input.supabase as unknown as ReflectionSupabase;
  const reflectionText = buildReflection(input);
  const { data, error } = await db.from("sophia_reflections").insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    run_id: input.runId ?? null,
    message_id: input.messageId ?? null,
    scope: "user",
    source_type: "feedback",
    source_id: input.messageId ?? null,
    failed_intent: input.failedIntent ?? null,
    original_answer: input.originalAnswer.slice(0, 8000),
    user_feedback: input.userFeedback.slice(0, 4000),
    corrected_answer: input.correctedAnswer?.slice(0, 8000) ?? null,
    possible_fix: reflectionText,
    reflection: reflectionText,
    status: "active",
  }).select("id").maybeSingle();
  if (error) throw new Error(error.message);

  const ruleKey = buildRuleKey(input.failedIntent, input.userFeedback);
  const countResult = await db.from("sophia_reflections").select("id").eq("organization_id", input.organizationId).eq("user_id", input.userId).eq("failed_intent", input.failedIntent ?? "unknown").eq("status", "active");
  const evidenceCount = countResult.data?.length ?? 1;
  let candidateId: string | null = null;
  if (evidenceCount >= (input.threshold ?? Number(process.env.SOPHIA_RULE_MIN_EVIDENCE ?? 3))) {
    const examples = (countResult.data ?? []).slice(0, 6).map((item) => item.id);
    const candidate = await db.from("sophia_rule_candidates").upsert({
      organization_id: input.organizationId,
      rule_key: ruleKey,
      evidence_count: evidenceCount,
      examples,
      status: "pending",
      created_by: input.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,rule_key" }).select("id").maybeSingle();
    candidateId = candidate.data?.id ?? null;
  }
  return { reflectionId: data?.id ?? null, evidenceCount, candidateId };
}

function buildReflection(input: { failedIntent?: string | null; userFeedback: string; correctedAnswer?: string | null }) {
  return `Intencao ${input.failedIntent ?? "desconhecida"}: considerar a correcao do usuario (${input.userFeedback.slice(0, 500)})${input.correctedAnswer ? ` e a resposta corrigida (${input.correctedAnswer.slice(0, 500)})` : ""}.`;
}

function buildRuleKey(intent: string | null | undefined, feedback: string) {
  const normalized = feedback.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return `${intent ?? "unknown"}:${normalized || "correcao"}`;
}

type ReflectionQuery = PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }> & {
  eq(column: string, value: string): ReflectionQuery;
};
type ReflectionSupabase = {
  from(table: string): {
    insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: { id?: string } | null; error: { message: string } | null }> } };
    select(columns: string): ReflectionQuery;
    upsert(value: Record<string, unknown>, options: { onConflict: string }): { select(columns: string): { maybeSingle(): Promise<{ data: { id?: string } | null; error: { message: string } | null }> } };
  };
};
