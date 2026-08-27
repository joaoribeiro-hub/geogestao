export type SophiaSkill = {
  id: string;
  name: string;
  description: string;
  examples: string[];
  tools: string[];
  riskLevel: "read" | "internal_write" | "external_write" | "destructive";
  requiresConfirmation: boolean;
  enabledModules: string[];
  permissions: string[];
};

export const SOPHIA_SKILLS: SophiaSkill[] = [
  { id: "responder_atividade_membro", name: "Responder atividade de membro", description: "Consulta checklist, rotina e atividade recente.", examples: ["O que a Natalia esta fazendo agora?"], tools: ["tasks.list_pending", "checklist.today"], riskLevel: "read", requiresConfirmation: false, enabledModules: ["routine"], permissions: ["member"] },
  { id: "concluir_etapa_servico", name: "Concluir etapa de servico", description: "Localiza e conclui etapa de um servico.", examples: ["Conclui a etapa do servico"], tools: ["service_steps.complete"], riskLevel: "internal_write", requiresConfirmation: true, enabledModules: ["services"], permissions: ["owner", "member"] },
  { id: "resumir_cliente", name: "Resumir cliente", description: "Resume dados e atividade do cliente.", examples: ["Resuma o cliente"], tools: ["clients.summarize"], riskLevel: "read", requiresConfirmation: false, enabledModules: ["clients"], permissions: ["member"] },
  { id: "buscar_documento", name: "Buscar documento", description: "Busca metadados e trechos documentais.", examples: ["Procure a matricula"], tools: ["documents.search", "document_search"], riskLevel: "read", requiresConfirmation: false, enabledModules: ["documents"], permissions: ["member"] },
  { id: "analisar_documento", name: "Analisar documento", description: "Responde usando evidencia citavel.", examples: ["O que diz o contrato?"], tools: ["document_answer", "document_summarize"], riskLevel: "read", requiresConfirmation: false, enabledModules: ["documents"], permissions: ["member"] },
  { id: "criar_tarefa", name: "Criar tarefa", description: "Cria tarefa interna.", examples: ["Crie uma tarefa"], tools: ["tasks.create_checklist_item"], riskLevel: "internal_write", requiresConfirmation: true, enabledModules: ["routine"], permissions: ["member"] },
  { id: "consultar_buscageo", name: "Consultar BuscaGEO", description: "Consulta jobs do BuscaGEO.", examples: ["Mostre jobs do BuscaGEO"], tools: ["geo.buscageo_jobs.list"], riskLevel: "read", requiresConfirmation: false, enabledModules: ["buscageo"], permissions: ["member"] },
  { id: "consultar_analise_ambiental", name: "Consultar analise ambiental", description: "Consulta jobs ambientais.", examples: ["Mostre minhas analises ambientais"], tools: ["geo.environmental_jobs.list"], riskLevel: "read", requiresConfirmation: false, enabledModules: ["analise-ambiental"], permissions: ["member"] },
];

export function getSophiaSkill(skillId: string) {
  return SOPHIA_SKILLS.find((skill) => skill.id === skillId) ?? null;
}

export function skillsForTools(toolIds: string[]) {
  const wanted = new Set(toolIds);
  return SOPHIA_SKILLS.filter((skill) => skill.tools.some((tool) => wanted.has(tool)));
}

