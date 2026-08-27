import { detectAssistantIntent, normalizeAssistantText } from "@/lib/assistant/intent-detector";
import { executeAssistantIntent, intentToActionName } from "@/lib/assistant/actions";
import type { AssistantIntentDetection, AssistantIntentName } from "@/lib/assistant/types";
import { getAvailableToolsForOrganization } from "@/lib/tools/tool-access";
import type { Json } from "@/types/database";
import type { SophiaContext, SophiaPlan, SophiaToolDefinition, SophiaToolResult } from "@/lib/sophia/types";
import { answerFromEvidence, retrieveDocumentEvidence } from "@/lib/sophia/v3/self-rag";
import { callWorkerWithRetry } from "@/lib/workers/worker-client";
import { runAiAgent } from "@/lib/ai-agents/runner";

const jsonSchemaObject = (properties: Record<string, unknown> = {}) => ({
  type: "object",
  properties,
  additionalProperties: true,
});

function legacyTool({
  id,
  name,
  description,
  intent,
  riskLevel = "read",
  agent = "operations",
}: {
  id: string;
  name: string;
  description: string;
  intent: AssistantIntentName;
  riskLevel?: SophiaToolDefinition["riskLevel"];
  agent?: SophiaToolDefinition["agent"];
}): SophiaToolDefinition {
  return {
    id,
    name,
    description,
    version: "1",
    agent,
    riskLevel,
    parameters: jsonSchemaObject(),
    execute: async (context, input) => runLegacyIntent(context, intent, input),
  };
}

export const SOPHIA_TOOLS: SophiaToolDefinition[] = [
  legacyTool({
    id: "services.list_today",
    name: "Listar servicos de hoje",
    description: "Lista serviços do dia usando filtros operacionais reais do GeoGestao.",
    intent: "list_today_services",
  }),
  legacyTool({
    id: "services.list_month",
    name: "Listar servicos do mes",
    description: "Lista serviços do mês atual ou período informado.",
    intent: "list_month_services",
  }),
  legacyTool({
    id: "services.list_overdue",
    name: "Listar servicos atrasados",
    description: "Lista serviços atrasados da organização respeitando permissões.",
    intent: "list_overdue_services",
  }),
  legacyTool({
    id: "services.create",
    name: "Criar servico",
    description: "Cria serviço pelo fluxo server-side existente, sempre com confirmação.",
    intent: "create_service",
    riskLevel: "internal_write",
  }),
  legacyTool({
    id: "service_steps.complete",
    name: "Concluir etapa de servico",
    description: "Marca item do Checklist - Etapas como concluído, recalcula serviço e registra movimentação.",
    intent: "complete_service_step",
    riskLevel: "internal_write",
  }),
  legacyTool({
    id: "services.update_due_date",
    name: "Alterar data prevista de servico",
    description: "Atualiza prazo pelo fluxo operacional existente e exige confirmacao humana.",
    intent: "postpone_service_due_date",
    riskLevel: "internal_write",
  }),
  legacyTool({
    id: "tasks.list_pending",
    name: "Listar tarefas pendentes",
    description: "Lista tarefas abertas/checklist operacional do usuário ou empresa.",
    intent: "list_pending_tasks",
    agent: "routine",
  }),
  legacyTool({
    id: "tasks.create_checklist_item",
    name: "Criar item de checklist",
    description: "Cria item de checklist/tarefa pela action registry existente.",
    intent: "create_checklist_item",
    riskLevel: "internal_write",
    agent: "routine",
  }),
  legacyTool({
    id: "tasks.assign_member",
    name: "Atribuir tarefa a membro",
    description: "Cria tarefa para membro ativo da mesma organização.",
    intent: "assign_checklist_item",
    riskLevel: "internal_write",
    agent: "routine",
  }),
  legacyTool({
    id: "checklist.today",
    name: "Consultar checklist de hoje",
    description: "Consulta checklist diário real.",
    intent: "list_today_checklist",
    agent: "routine",
  }),
  legacyTool({
    id: "members.current_activity",
    name: "Consultar trabalho atual de membro",
    description: "Consulta checklist e atividade recente de membro da organizacao com correspondencia de nome.",
    intent: "list_member_current_status",
    agent: "routine",
  }),
  legacyTool({
    id: "clients.find",
    name: "Buscar cliente",
    description: "Busca cliente por nome dentro da organização atual.",
    intent: "find_client_by_name",
  }),
  legacyTool({
    id: "clients.summarize",
    name: "Resumir cliente",
    description: "Resume dados e histórico do cliente pelo backend existente.",
    intent: "summarize_client",
  }),
  legacyTool({
    id: "clients.create_task",
    name: "Criar tarefa de cliente",
    description: "Cria tarefa vinculada a cliente com confirmação humana.",
    intent: "create_client_task",
    riskLevel: "internal_write",
  }),
  legacyTool({
    id: "clients.create_interaction",
    name: "Criar interacao de cliente",
    description: "Registra interação/lembrete no cliente com confirmação humana.",
    intent: "create_client_interaction",
    riskLevel: "internal_write",
  }),
  {
    id: "documents.search",
    name: "Buscar documentos",
    description: "Busca documentos e chunks já processados por nome, metadados e texto extraído.",
    version: "1",
    agent: "documents",
    riskLevel: "read",
    parameters: jsonSchemaObject({ term: { type: "string" } }),
    execute: searchDocuments,
  },
  {
    id: "document_ingest",
    name: "Processar documento para a Sophia",
    description: "Inicia a leitura local, OCR sob demanda e indexacao de um documento autorizado.",
    version: "1",
    agent: "documents",
    riskLevel: "internal_write",
    parameters: jsonSchemaObject({ document_id: { type: "string" }, inbox_item_id: { type: "string" } }),
    execute: ingestDocument,
  },
  {
    id: "document_search",
    name: "Buscar trechos em documentos",
    description: "Busca trechos indexados com pagina e fonte para citacao.",
    version: "1",
    agent: "documents",
    riskLevel: "read",
    parameters: jsonSchemaObject({ query: { type: "string" }, document_id: { type: "string" } }),
    execute: searchDocumentChunks,
  },
  {
    id: "document_answer",
    name: "Responder sobre documento",
    description: "Responde usando trechos indexados e cita o documento e a pagina.",
    version: "1",
    agent: "documents",
    riskLevel: "read",
    parameters: jsonSchemaObject({ question: { type: "string" }, document_id: { type: "string" } }),
    execute: answerFromDocuments,
  },
  {
    id: "document_summarize",
    name: "Resumir documento",
    description: "Usa resumo salvo ou cria um resumo extrativo local, sem enviar o arquivo inteiro a modelo externo.",
    version: "1",
    agent: "documents",
    riskLevel: "read",
    parameters: jsonSchemaObject({ document_id: { type: "string" } }),
    execute: summarizeDocument,
  },
  {
    id: "modules.list_available",
    name: "Listar ferramentas disponiveis",
    description: "Lista ferramentas/módulos reais disponíveis para a organização.",
    version: "1",
    agent: "coordinator",
    riskLevel: "read",
    parameters: jsonSchemaObject(),
    execute: listAvailableModules,
  },
  {
    id: "geo.environmental_jobs.list",
    name: "Listar analises ambientais",
    description: "Lista jobs reais da ferramenta Análise Ambiental da organização.",
    version: "1",
    moduleKey: "analise-ambiental",
    agent: "geo",
    riskLevel: "read",
    parameters: jsonSchemaObject(),
    execute: listEnvironmentalJobs,
  },
  {
    id: "geo.buscageo_jobs.list",
    name: "Listar jobs BuscaGEO",
    description: "Lista jobs reais do BuscaGEO da organização.",
    version: "1",
    moduleKey: "buscageo",
    agent: "geo",
    riskLevel: "read",
    parameters: jsonSchemaObject(),
    execute: listBuscaGeoJobs,
  },
  {
    id: "agents.briefing.run",
    name: "Executar briefing da manha",
    description: "Executa o agente real de briefing e salva o resultado para o usuario atual.",
    version: "1",
    agent: "routine",
    riskLevel: "read",
    parameters: jsonSchemaObject(),
    execute: (context) => runOperationalAgent(context, "briefing-matinal"),
  },
  {
    id: "agents.weekly_review.run",
    name: "Executar revisao semanal",
    description: "Executa a revisao semanal com dados proprios ou visao geral para owner.",
    version: "1",
    agent: "routine",
    riskLevel: "read",
    parameters: jsonSchemaObject(),
    execute: (context) => runOperationalAgent(context, "revisao-semanal"),
  },
];

export function getSophiaToolRegistry() {
  return SOPHIA_TOOLS;
}

export function getSophiaTool(toolId: string) {
  return SOPHIA_TOOLS.find((tool) => tool.id === toolId) ?? null;
}

export function planSophiaToolCall(message: string, confirmation?: { actionName: string; params: Record<string, Json> } | null): SophiaPlan {
  if (confirmation) {
    const tool = SOPHIA_TOOLS.find((item) => item.id === actionNameToToolId(confirmation.actionName));
    return {
      agentKey: tool?.agent ?? "coordinator",
      toolId: tool?.id ?? null,
      input: confirmation.params,
      provider: "local",
      confidence: tool ? 1 : 0,
      requiresConfirmation: false,
      reason: "confirmed_action",
    };
  }

  const normalized = normalizeAssistantText(message);
  if (/\b(documento|documentos|arquivo|pdf|matricula|contrato)\b/.test(normalized)) {
    const isQuestion = /\b(qual|quais|onde|quando|quanto|cont[eé]m|leia|resuma|explique)\b/.test(normalized);
    return {
      agentKey: "documents",
      toolId: isQuestion ? "document_answer" : "documents.search",
      input: isQuestion ? { question: message } : { term: message },
      provider: "local",
      confidence: 0.75,
      requiresConfirmation: false,
      reason: "document_terms",
    };
  }
  if (/\b(ferramenta|modulo|modulos|buscageo|analise ambiental|ambiental|kml|mapbiomas)\b/.test(normalized)) {
    const toolId = /\b(buscageo|cbers)\b/.test(normalized)
      ? "geo.buscageo_jobs.list"
      : /\b(analise ambiental|ambiental|mapbiomas|kml)\b/.test(normalized)
        ? "geo.environmental_jobs.list"
        : "modules.list_available";
    return {
      agentKey: toolId.startsWith("geo.") ? "geo" : "coordinator",
      toolId,
      input: {},
      provider: "local",
      confidence: 0.7,
      requiresConfirmation: false,
      reason: "module_terms",
    };
  }

  const detection = detectAssistantIntent(message);
  const actionName = intentToActionName[detection.intent];
  const toolId = actionName ? actionNameToToolId(actionName) : null;
  const tool = toolId ? getSophiaTool(toolId) : null;
  return {
    agentKey: tool?.agent ?? "coordinator",
    toolId: tool?.id ?? null,
    input: detection.params,
    provider: "local",
    confidence: detection.confidence,
    requiresConfirmation: shouldConfirmTool(tool, detection),
    reason: detection.intent,
  };
}

function shouldConfirmTool(tool: SophiaToolDefinition | null, detection: AssistantIntentDetection) {
  if (!tool) return false;
  return detection.needsConfirmation || tool.riskLevel !== "read";
}

function actionNameToToolId(actionName: string) {
  const mapping: Record<string, string> = {
    listTodayServices: "services.list_today",
    listMonthServices: "services.list_month",
    listOverdueServices: "services.list_overdue",
    listPendingTasks: "tasks.list_pending",
    findClientByName: "clients.find",
    summarizeClient: "clients.summarize",
    createClientTask: "clients.create_task",
    createClientInteraction: "clients.create_interaction",
    createService: "services.create",
    completeServiceStep: "service_steps.complete",
    postponeServiceDueDate: "services.update_due_date",
    listMemberActivity: "members.current_activity",
    listTodayChecklist: "checklist.today",
    createChecklistItem: "tasks.create_checklist_item",
    assignChecklistItem: "tasks.assign_member",
  };
  return mapping[actionName] ?? actionName;
}

function toolIdToDetection(toolId: string, input: Record<string, Json>): AssistantIntentDetection | null {
  const mapping: Record<string, AssistantIntentName> = {
    "services.list_today": "list_today_services",
    "services.list_month": "list_month_services",
    "services.list_overdue": "list_overdue_services",
    "services.create": "create_service",
    "service_steps.complete": "complete_service_step",
    "services.update_due_date": "postpone_service_due_date",
    "tasks.list_pending": "list_pending_tasks",
    "tasks.create_checklist_item": "create_checklist_item",
    "tasks.assign_member": "assign_checklist_item",
    "checklist.today": "list_today_checklist",
    "members.current_activity": "list_member_current_status",
    "clients.find": "find_client_by_name",
    "clients.summarize": "summarize_client",
    "clients.create_task": "create_client_task",
    "clients.create_interaction": "create_client_interaction",
  };
  const intent = mapping[toolId];
  if (!intent) return null;
  return {
    intent,
    confidence: 1,
    params: input,
    needsConfirmation: false,
  };
}

async function runLegacyIntent(context: SophiaContext, intent: AssistantIntentName, input: Record<string, Json>) {
  const result = await executeAssistantIntent(
    {
      supabase: context.supabase,
      user: context.user,
      organizationId: context.organizationId,
    },
    { intent, confidence: 1, params: input, needsConfirmation: false },
  );
  return {
    message: result.message,
    data: result.data ?? null,
    output: result.output ?? result.data ?? null,
    status: result.status,
    confirmation: result.confirmation ?? null,
  } satisfies SophiaToolResult;
}

export function detectionForTool(toolId: string, input: Record<string, Json>) {
  return toolIdToDetection(toolId, input);
}

async function searchDocuments(context: SophiaContext, input: Record<string, Json>): Promise<SophiaToolResult> {
  const term = String(input.term ?? "").trim();
  const like = `%${term.replace(/[%_]/g, "")}%`;
  let query = context.supabase
    .from("documents")
    .select("id,title,original_name,document_type,category,description,notes,processing_status,created_at")
    .eq("organization_id", context.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (term) {
    query = query.or(`title.ilike.${like},original_name.ilike.${like},document_type.ilike.${like},category.ilike.${like},description.ilike.${like},notes.ilike.${like},extracted_text.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const documents = data ?? [];
  return {
    message: documents.length
      ? `Encontrei ${documents.length} documento(s) relacionado(s).`
      : "Nao encontrei documentos com esse termo na organizacao atual.",
    data: { documents } as Json,
    output: { documents } as Json,
    status: "ok",
  };
}

async function ingestDocument(context: SophiaContext, input: Record<string, Json>): Promise<SophiaToolResult> {
  const documentId = typeof input.document_id === "string" ? input.document_id : null;
  const inboxItemId = typeof input.inbox_item_id === "string" ? input.inbox_item_id : null;
  if (!documentId && !inboxItemId) return { message: "Informe um documento ou item da caixa de entrada.", status: "error" };
  const workerUrl = process.env.SOPHIA_DOCUMENT_WORKER_URL?.replace(/\/$/, "");
  const workerSecret = process.env.SOPHIA_DOCUMENT_WORKER_SECRET;
  if (!workerUrl || !workerSecret) return { message: "Leitura documental nao configurada no servidor.", status: "error" };
  const path = inboxItemId ? `/inbox/${inboxItemId}/ingest` : `/documents/${documentId}/ingest`;
  const result = await callWorkerWithRetry({ url: workerUrl, secret: workerSecret, path, method: "POST" });
  if (!result.ok) return { message: result.message ?? "O worker documental recusou o processamento.", data: (result.data ?? {}) as Json, status: "error" };
  return { message: result.message ?? "Processamento documental iniciado e registrado.", data: { ...(result.data ?? {}), worker_status: result.workerStatus } as Json, status: "ok" };
}

async function searchDocumentChunks(context: SophiaContext, input: Record<string, Json>): Promise<SophiaToolResult> {
  const term = String(input.query ?? input.term ?? "").trim();
  const documentId = typeof input.document_id === "string" ? input.document_id : null;
  const citations = await retrieveDocumentEvidence(context, { query: term, documentId, limit: 12 });
  return {
    message: citations.length ? `Encontrei ${citations.length} trecho(s) citavel(is).` : "Nao encontrei trechos processados para essa busca.",
    data: { citations } as Json,
    output: { citations } as Json,
    status: "ok",
  };
}

async function answerFromDocuments(context: SophiaContext, input: Record<string, Json>): Promise<SophiaToolResult> {
  const question = String(input.question ?? input.query ?? "").trim();
  const evidence = await retrieveDocumentEvidence(context, { query: question, documentId: typeof input.document_id === "string" ? input.document_id : null, limit: 12 });
  const answer = answerFromEvidence(evidence);
  return { message: answer.answer, data: { citations: answer.citations, answer: answer.answer } as Json, output: { citations: answer.citations, answer: answer.answer } as Json, status: "ok" };
}

async function summarizeDocument(context: SophiaContext, input: Record<string, Json>): Promise<SophiaToolResult> {
  const documentId = typeof input.document_id === "string" ? input.document_id : null;
  if (!documentId) return { message: "Informe o documento a resumir.", status: "error" };
  const db = context.supabase as unknown as DocumentSummarySupabase;
  const summaryResult = await db.from("document_ai_summaries").select("summary,document_type,provider,confidence,created_at").eq("organization_id", context.organizationId).eq("document_id", documentId).order("created_at", { ascending: false }).limit(1);
  if (summaryResult.data?.length) return { message: summaryResult.data[0].summary, data: summaryResult.data[0] as Json, status: "ok" };
  const chunks = await searchDocumentChunks(context, { document_id: documentId });
  return { message: chunks.message, data: chunks.data, status: "ok" };
}

type DocumentSummarySupabase = {
  from(table: string): { select(columns: string): DocumentSummaryChain };
};
type DocumentSummaryChain = PromiseLike<{ data: Array<{ summary: string; [key: string]: unknown }> | null; error: { message: string } | null }> & {
  eq(column: string, value: string): DocumentSummaryChain;
  order(column: string, options: { ascending: boolean }): DocumentSummaryChain;
  limit(value: number): DocumentSummaryChain;
};

async function listAvailableModules(): Promise<SophiaToolResult> {
  const tools = getAvailableToolsForOrganization().map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    status: tool.status,
    routePath: tool.routePath,
    pricingMode: tool.pricingMode,
  }));
  return {
    message: `Encontrei ${tools.length} ferramenta(s) cadastradas no GeoGestao.`,
    data: { tools } as Json,
    output: { tools } as Json,
    status: "ok",
  };
}

async function listEnvironmentalJobs(context: SophiaContext): Promise<SophiaToolResult> {
  const { data, error } = await context.supabase
    .from("module_environmental_analysis_jobs")
    .select("id,status,original_filename,progress_percent,provider_key,created_at,area_ha,requested_layers")
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return {
    message: data?.length
      ? `Encontrei ${data.length} analise(s) ambiental(is) recentes.`
      : "Nao encontrei analises ambientais recentes nesta organizacao.",
    data: { jobs: data ?? [] } as Json,
    output: { jobs: data ?? [] } as Json,
    status: "ok",
  };
}

async function listBuscaGeoJobs(context: SophiaContext): Promise<SophiaToolResult> {
  const { data, error } = await context.supabase
    .from("module_buscageo_jobs")
    .select("id,status,original_filename,created_at,scene_count,output_storage_path")
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return {
    message: data?.length
      ? `Encontrei ${data.length} job(s) BuscaGEO recentes.`
      : "Nao encontrei jobs BuscaGEO recentes nesta organizacao.",
    data: { jobs: data ?? [] } as Json,
    output: { jobs: data ?? [] } as Json,
    status: "ok",
  };
}

async function runOperationalAgent(context: SophiaContext, slug: "briefing-matinal" | "revisao-semanal"): Promise<SophiaToolResult> {
  const run = await runAiAgent({
    supabase: context.supabase,
    organizationId: context.organizationId,
    userId: context.user.id,
    slug,
    isOwner: context.isOwner,
    triggerType: "manual",
    runDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
  });
  const output = run.output && typeof run.output === "object" && !Array.isArray(run.output) ? run.output : {};
  const summary = typeof run.summary === "string" && run.summary.trim()
    ? run.summary
    : "A execucao foi salva, mas ainda nao possui resumo.";
  return {
    message: summary,
    data: { run_id: run.id, slug, output } as Json,
    output: { run_id: run.id, slug, output } as Json,
    status: "ok",
  };
}
