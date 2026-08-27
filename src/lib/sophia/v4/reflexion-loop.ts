import type { SophiaContext } from "@/lib/sophia/types";
import { sanitizeSophiaPrivateText } from "@/lib/sophia/v4/privacy-sanitizer";
import { selectSophiaV4Skill } from "@/lib/sophia/v4/skill-library";

export type SophiaV4ReflectionDraft = {
  probable_error: string;
  correct_skill: string | null;
  missing_context: string[];
  candidate_rule: string;
  future_test: string;
  sanitized_feedback: string;
};

export function buildSophiaV4Reflection(input: {
  question: string;
  answer: string;
  feedback: string;
  correction?: string | null;
}) : SophiaV4ReflectionDraft {
  const selection = selectSophiaV4Skill(input.question);
  const sanitizedFeedback = sanitizeSophiaPrivateText(input.feedback);
  const correction = sanitizeSophiaPrivateText(input.correction ?? "");
  return {
    probable_error: selection.skill ? "A resposta nao aplicou a skill local mais especifica." : "Faltou classificar a intencao ou recuperar contexto suficiente.",
    correct_skill: selection.skill?.skill_key ?? null,
    missing_context: inferMissingContext(input.question),
    candidate_rule: correction || sanitizedFeedback,
    future_test: `Pergunta: ${sanitizeSophiaPrivateText(input.question)} | Esperado: ${correction || sanitizedFeedback}`.slice(0, 2000),
    sanitized_feedback: sanitizedFeedback,
  };
}

export async function recordSophiaV4Feedback(input: {
  context: SophiaContext;
  runId?: string | null;
  messageId?: string | null;
  question: string;
  answer: string;
  feedback: string;
  correction?: string | null;
  threshold?: number;
}) {
  const database = input.context.supabase as unknown as ReflectionDatabase;
  const draft = buildSophiaV4Reflection(input);
  const { data: reflection, error } = await database.from("sophia_reflections").insert({
    organization_id: input.context.organizationId,
    user_id: input.context.user.id,
    run_id: input.runId ?? null,
    message_id: input.messageId ?? null,
    scope: "user",
    source_type: "feedback_v4",
    failed_intent: draft.correct_skill ?? "unknown",
    original_answer: input.answer.slice(0, 8000),
    user_feedback: input.feedback.slice(0, 4000),
    corrected_answer: input.correction?.slice(0, 8000) ?? null,
    possible_fix: JSON.stringify(draft),
    reflection: draft.probable_error,
    status: "active",
  }).select("id").maybeSingle();
  if (error) throw new Error(error.message);

  const { data: evidence } = await database.from("sophia_reflections").select("id").eq("organization_id", input.context.organizationId).eq("user_id", input.context.user.id).eq("failed_intent", draft.correct_skill ?? "unknown").eq("status", "active");
  const evidenceCount = evidence?.length ?? 1;
  const threshold = input.threshold ?? Number(process.env.SOPHIA_RULE_MIN_EVIDENCE ?? 3);
  let candidateId: string | null = null;
  if (evidenceCount >= threshold) {
    const ruleKey = `${draft.correct_skill ?? "unknown"}:${slug(draft.candidate_rule).slice(0, 80)}`;
    const { data: candidate } = await database.from("sophia_rule_candidates").upsert({
      organization_id: input.context.organizationId,
      rule_key: ruleKey,
      evidence_count: evidenceCount,
      examples: (evidence ?? []).slice(0, 8).map((item) => item.id),
      status: "pending",
      created_by: input.context.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,rule_key" }).select("id").maybeSingle();
    candidateId = candidate?.id ?? null;
  }
  const { data: evalCase } = await database.from("sophia_eval_cases").insert({
    organization_id: input.context.organizationId,
    title: `Regressao: ${draft.correct_skill ?? "resposta corrigida"}`,
    input_text: input.question.slice(0, 2000),
    expected_behavior: (input.correction ?? input.feedback).slice(0, 4000),
    expected_tool: selectionTool(draft.correct_skill),
    scope: "organization",
    active: true,
  }).select("id").maybeSingle();
  return { reflectionId: reflection?.id ?? null, candidateId, evalCaseId: evalCase?.id ?? null, evidenceCount, draft };
}

function inferMissingContext(question: string) {
  const normalized = question.toLowerCase();
  return [
    /fazendo|atividade|tarefa/.test(normalized) ? "membro_e_tarefas" : null,
    /servic|etapa/.test(normalized) ? "servico_e_checklist" : null,
    /document|pdf|contrato/.test(normalized) ? "evidencia_documental" : null,
  ].filter((item): item is string => Boolean(item));
}

function selectionTool(skill: string | null) {
  const mapping: Record<string, string> = {
    consultar_trabalho_atual_membro: "members.current_activity",
    concluir_etapa_servico: "service_steps.complete",
    alterar_data_prevista_servico: "services.update_due_date",
  };
  return skill ? mapping[skill] ?? null : null;
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type ReflectionQuery = PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }> & {
  eq(column: string, value: string): ReflectionQuery;
};
type ReflectionTable = {
  select(columns: string): ReflectionQuery;
  insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: { id?: string } | null; error: { message: string } | null }> } };
  upsert(value: Record<string, unknown>, options: { onConflict: string }): { select(columns: string): { maybeSingle(): Promise<{ data: { id?: string } | null; error: { message: string } | null }> } };
};
type ReflectionDatabase = { from(table: string): ReflectionTable };
