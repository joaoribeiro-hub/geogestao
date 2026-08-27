import type { Json } from "@/types/database";
import type { SophiaV4Skill, SophiaV4SkillSelection } from "@/lib/sophia/v4/skill-types";

const objectSchema = (properties: Record<string, Json> = {}) => ({ type: "object", properties } as Record<string, Json>);

export const SOPHIA_V4_SKILLS: SophiaV4Skill[] = [
  skill("consultar_trabalho_atual_membro", "Consultar trabalho atual de membro", "Consulta tarefas, checklist e atividade operacional recente de um membro.", ["O que a Natalia esta fazendo agora?"], ["members.current_activity"], ["routine"], "read", false, "routine", "member_activity"),
  skill("concluir_etapa_servico", "Concluir etapa de servico", "Localiza uma etapa real e conclui somente depois de confirmacao.", ["Conclui a etapa memorial no servico Fazenda Azul"], ["service_steps.complete"], ["services"], "internal_write", true, "services", "database_state"),
  skill("alterar_data_prevista_servico", "Alterar data prevista do servico", "Atualiza a data prevista de um servico permitido.", ["Adie em dois dias o servico Fazenda Azul"], ["services.update_due_date"], ["services"], "internal_write", true, "services", "database_state"),
  skill("resumir_cliente", "Resumir cliente", "Monta resumo operacional usando dados permitidos da organizacao.", ["Resuma o cliente Almeida"], ["clients.summarize"], ["clients"], "read", false, "clients", "handler_output"),
  skill("buscar_documento", "Buscar documento", "Busca documentos e trechos na organizacao atual.", ["Procure a matricula 123"], ["documents.search", "document_search"], ["documents"], "read", false, "documents", "handler_output"),
  skill("responder_documento_com_citacoes", "Responder documento com citacoes", "Responde apenas com evidencia documental citavel.", ["O contrato informa qual prazo?"], ["document_answer"], ["documents"], "read", false, "documents", "citation_support"),
  skill("processar_documento_inbox", "Processar documento da caixa de entrada", "Encaminha anexo autenticado ao worker documental.", ["Processe este PDF"], ["document_ingest"], ["documents"], "internal_write", false, "documents", "handler_output"),
  skill("criar_tarefa", "Criar tarefa", "Cria tarefa operacional para usuario permitido.", ["Crie tarefa para ligar ao cartorio"], ["tasks.create_checklist_item"], ["routine"], "internal_write", true, "routine", "database_state"),
  skill("criar_lembrete", "Criar lembrete", "Cria interacao com lembrete usando o fluxo real existente.", ["Crie lembrete para retornar ao cliente"], ["clients.create_interaction"], ["agenda"], "internal_write", true, "routine", "database_state"),
  skill("listar_jobs_buscageo", "Listar jobs BuscaGEO", "Consulta jobs reais do modulo BuscaGEO.", ["Mostre os jobs do BuscaGEO"], ["geo.buscageo_jobs.list"], ["buscageo"], "read", false, "tools", "handler_output"),
  skill("listar_jobs_analise_ambiental", "Listar jobs de analise ambiental", "Consulta jobs reais da Analise Ambiental.", ["Mostre as analises ambientais"], ["geo.environmental_jobs.list"], ["analise-ambiental"], "read", false, "tools", "handler_output"),
  skill("briefing_manha", "Briefing da manha", "Executa o agente real de briefing para o usuario atual.", ["Gere meu briefing da manha"], ["agents.briefing.run"], [], "read", false, "routine", "handler_output"),
  skill("revisao_semanal", "Revisao semanal", "Executa revisao semanal respeitando visao propria ou de owner.", ["Gere a revisao semanal"], ["agents.weekly_review.run"], [], "read", false, "routine", "handler_output"),
];

export function getSophiaV4Skill(skillKey: string) {
  return SOPHIA_V4_SKILLS.find((item) => item.skill_key === skillKey) ?? null;
}

export function selectSophiaV4Skill(text: string, options: { hasAttachment?: boolean; role?: string } = {}): SophiaV4SkillSelection {
  const normalized = normalize(text);
  const match = (skillKey: string, confidence: number, input: Record<string, Json>, reason: string): SophiaV4SkillSelection => ({
    skill: getSophiaV4Skill(skillKey), confidence, input, reason,
  });
  if (options.hasAttachment && /\b(processe|processar|anexo|arquivo|documento)\b/.test(normalized)) return match("processar_documento_inbox", 1, {}, "attachment");
  if (/\b(o que|qual).*(fazendo|trabalhando|atividade|tarefa).*agora\b/.test(normalized) || /\b(trabalho|atividade) atual\b/.test(normalized)) {
    return match("consultar_trabalho_atual_membro", 0.99, { memberName: extractMemberName(text) }, "member_current_work");
  }
  if (/\b(conclui|concluir|terminei|finalizei|marcar).*(etapa|checklist)\b/.test(normalized)) return match("concluir_etapa_servico", 0.96, extractServiceStep(text), "complete_step");
  if (/\b(adie|adiar|postergue|alterar|mudar|atualizar).*(data|prazo|previs)\b/.test(normalized)) return match("alterar_data_prevista_servico", 0.94, {}, "service_due_date");
  if (/\b(resum|resumo).*(cliente)\b/.test(normalized)) return match("resumir_cliente", 0.93, { clientName: extractAfter(text, "cliente") }, "client_summary");
  if (/\b(documento|arquivo|pdf|contrato|matricula)\b/.test(normalized)) {
    const asksAnswer = /\b(o que|qual|quais|explique|resuma|informa|diz|permite|preve|prazo|valor)\b/.test(normalized);
    return match(asksAnswer ? "responder_documento_com_citacoes" : "buscar_documento", 0.91, asksAnswer ? { question: text } : { term: text }, "documents");
  }
  if (/\b(crie|criar|adicione|adicionar).*(tarefa|checklist)\b/.test(normalized)) return match("criar_tarefa", 0.92, {}, "create_task");
  if (/\b(crie|criar|adicione|adicionar).*(lembrete|retorno)\b/.test(normalized)) return match("criar_lembrete", 0.9, {}, "create_reminder");
  if (/\b(buscageo|cbers)\b/.test(normalized)) return match("listar_jobs_buscageo", 0.98, {}, "buscageo");
  if (/\b(analis(?:e|es) ambienta(?:l|is)|mapbiomas|ambiental)\b/.test(normalized)) return match("listar_jobs_analise_ambiental", 0.97, {}, "environmental");
  if (/\bbriefing\b/.test(normalized)) return match("briefing_manha", 0.98, {}, "briefing");
  if (/\b(revisao|resumo).*(semana|semanal)\b/.test(normalized)) return match("revisao_semanal", 0.97, {}, "weekly_review");
  return { skill: null, confidence: 0, input: {}, reason: "no_local_skill" };
}

function skill(
  skill_key: string,
  name: string,
  description: string,
  examples: string[],
  required_tools: string[],
  required_modules: string[],
  risk_level: SophiaV4Skill["risk_level"],
  requires_confirmation: boolean,
  agent: SophiaV4Skill["agent"],
  verification_strategy: string,
): SophiaV4Skill {
  return {
    skill_key, name, description, examples, required_tools, required_modules, risk_level, requires_confirmation,
    permission_policy: { roles: ["owner", "admin", "gerente", "tecnico", "member"], own_data_only_for_non_owner: skill_key === "revisao_semanal" },
    input_schema: objectSchema(), output_schema: objectSchema(), verification_strategy,
    memory_policy: risk_level === "read" ? "none" : "episodic",
    eval_cases: examples,
    agent,
  };
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function extractMemberName(value: string) {
  const quoted = value.match(/["']([^"']+)["']/)?.[1];
  if (quoted) return quoted.trim();
  const match = value.match(/(?:a|o|membro|colaborador)\s+([A-ZÀ-Ý][\p{L}]+(?:\s+[A-ZÀ-Ý][\p{L}]+){0,3})/u);
  return match?.[1]?.trim() ?? null;
}

function extractServiceStep(value: string) {
  const quoted = [...value.matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
  return { stepName: quoted[0] ?? null, serviceName: quoted[1] ?? extractAfter(value, "servico") } as Record<string, Json>;
}

function extractAfter(value: string, marker: string) {
  const normalizedMarker = new RegExp(`${marker}\\s+["']?([^"',.]+)`, "i");
  return value.match(normalizedMarker)?.[1]?.trim() ?? null;
}
