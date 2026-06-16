import { NOTIFICATION_ON_CONFLICT } from "@/lib/notifications/reminders";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
type AgentRunTriggerType = "manual" | "cron";
type AgentContext = {
  today: string;
  slug: string;
  tasks: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
  serviceSteps: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  workTime: Array<Record<string, unknown>>;
  finance: Array<Record<string, unknown>>;
};
export type AgentOutput = {
  summary: string;
  priorities: string[];
  sections: Array<{ title: string; items: string[] }>;
  tasks: Array<Record<string, unknown>>;
  deadlines: Array<Record<string, unknown>>;
  warnings: string[];
  nextActions: string[];
  reminders: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
  generatedAt: string;
};

export async function runAiAgent({
  supabase,
  organizationId,
  userId,
  slug,
  isOwner = false,
  triggerType = "manual",
  runDate,
}: {
  supabase: ServerSupabase;
  organizationId: string;
  userId: string;
  slug: string;
  isOwner?: boolean;
  triggerType?: AgentRunTriggerType;
  runDate?: string;
}) {
  const { data: agent, error: agentError } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (agentError || !agent) throw new Error(agentError?.message ?? "Agente nao encontrado.");
  if (slug === "financeiro" && !isOwner) {
    throw new Error("Agente financeiro disponivel apenas para owner.");
  }

  const dedupeStart = runDate ? `${runDate}T00:00:00.000-03:00` : new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const dedupeEnd = runDate ? `${runDate}T23:59:59.999-03:00` : undefined;
  let recentQuery = supabase
    .from("ai_agent_runs")
    .select("id,summary,status,created_at,output")
    .eq("organization_id", organizationId)
    .eq("agent_id", agent.id)
    .eq("triggered_by", userId)
    .gte("created_at", dedupeStart);
  if (dedupeEnd) recentQuery = recentQuery.lt("created_at", dedupeEnd);
  const { data: recentRuns } = await recentQuery.order("created_at", { ascending: false }).limit(1);
  const recentRun = recentRuns?.[0];
  if (recentRun?.status === "completed") return recentRun;

  const { data: runRows, error: runError } = await supabase
    .from("ai_agent_runs")
    .insert({
      organization_id: organizationId,
      agent_id: agent.id,
      triggered_by: userId,
      trigger_type: triggerType,
      status: "running",
      started_at: new Date().toISOString(),
      input: { slug, run_date: runDate ?? null } as Json,
    })
    .select("*")
    .limit(1);
  if (runError) throw new Error(runError.message);
  const run = runRows?.[0];
  if (!run) throw new Error("Nao foi possivel iniciar a execucao do agente.");

  try {
    const context = await buildAgentContext(supabase, organizationId, userId, slug, isOwner);
    const summary = await generateAgentSummary({
      agentName: agent.name,
      systemPrompt: agent.system_prompt,
      context,
    });
    const output = buildAgentOutput({ context, summary, generatedAt: new Date().toISOString() });
    const finishedAt = new Date().toISOString();
    const { data: completedRows, error: updateError } = await supabase
      .from("ai_agent_runs")
      .update({
        status: "completed",
        output: output as unknown as Json,
        summary,
        finished_at: finishedAt,
      })
      .eq("id", run.id)
      .select("*")
      .limit(1);
    if (updateError) throw new Error(updateError.message);
    const completed = completedRows?.[0] ?? {
      ...run,
      status: "completed" as const,
      output: output as unknown as Json,
      summary,
      finished_at: finishedAt,
    };

    await supabase.from("ai_agent_deliveries").insert({
      organization_id: organizationId,
      agent_run_id: run.id,
      user_id: userId,
      delivery_type: "in_app",
    });
    await supabase.from("notifications").upsert(
      {
        organization_id: organizationId,
        recipient_user_id: userId,
        type: "ai_agent_run",
        title: agent.name,
        message: preview(summary),
        entity_type: "ai_agent_run",
        entity_id: run.id,
        action_url: "/minha-conta",
        metadata: { category: "Notas", agent_slug: slug } as Json,
        scheduled_for: finishedAt,
        dedupe_key: `${organizationId}:${userId}:ai_agent_run:${run.id}`,
      },
      { onConflict: NOTIFICATION_ON_CONFLICT },
    );
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao executar agente.";
    await supabase
      .from("ai_agent_runs")
      .update({
        status: "error",
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    throw new Error(message);
  }
}

async function buildAgentContext(
  supabase: ServerSupabase,
  organizationId: string,
  userId: string,
  slug: string,
  isOwner: boolean,
) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  let checklistQuery = supabase
    .from("daily_checklist_items")
    .select("id,title,description,status,is_emergency,due_date,created_at,completed_at,source,assigned_to,related_service_id,sort_order")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (!isOwner) checklistQuery = checklistQuery.eq("assigned_to", userId);
  checklistQuery = slug === "revisao-semanal"
    ? checklistQuery.gte("due_date", weekAgo.toISOString().slice(0, 10))
    : checklistQuery.eq("status", "open").or(`due_date.lte.${today},due_date.is.null`);

  let routineQuery = supabase
    .from("routine_items")
    .select("id,title,description,status,is_emergency,routine_date,due_time,created_at,completed_at,source,user_id,daily_checklist_item_id,sort_order")
    .eq("organization_id", organizationId)
    .eq("routine_scope", "daily")
    .is("deleted_at", null);
  if (!isOwner) routineQuery = routineQuery.eq("user_id", userId);
  routineQuery = slug === "revisao-semanal"
    ? routineQuery.gte("routine_date", weekAgo.toISOString().slice(0, 10))
    : routineQuery.eq("status", "open").or(`routine_date.lte.${today},routine_date.is.null`);

  const [checklists, routineItems, reminders, notifications, serviceCards, serviceSteps, documents, workDays, finance] = await Promise.all([
    checklistQuery,
    routineQuery,
    supabase
      .from("agenda_reminders")
      .select("title,reminder_date,reminder_time,category,custom_category")
      .eq("organization_id", organizationId)
      .gte("reminder_date", slug === "revisao-semanal" ? weekAgo.toISOString().slice(0, 10) : today)
      .lte("reminder_date", today),
    supabase
      .from("notifications")
      .select("id,title,message,type,entity_type,entity_id,created_at")
      .eq("organization_id", organizationId)
      .eq("recipient_user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("service_cards")
      .select("id,title,due_date,priority,municipality,updated_at")
      .eq("organization_id", organizationId)
      .order("due_date", { ascending: true })
      .limit(40),
    supabase
      .from("checklists")
      .select("service_card_id,checklist_items(id,title,is_done,due_date,due_time,scheduled_at,completed_at)")
      .eq("organization_id", organizationId)
      .eq("checklist_type", "steps")
      .limit(80),
    supabase
      .from("documents")
      .select("id,title,original_name,document_type,processing_status,service_id,client_id,created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("work_time_days")
      .select("work_date,total_work_seconds,total_interval_seconds,total_field_seconds,status")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .gte("work_date", weekAgo.toISOString().slice(0, 10)),
    slug === "financeiro" || (slug === "revisao-semanal" && isOwner)
      ? supabase.from("revenues").select("amount,status,due_date,description").eq("organization_id", organizationId).limit(30)
      : Promise.resolve({ data: [] }),
  ]);
  const checklistTaskIds = new Set((checklists.data ?? []).map((item) => item.id));
  const routineOnlyTasks = (routineItems.data ?? []).filter((item) => !item.daily_checklist_item_id || !checklistTaskIds.has(item.daily_checklist_item_id));
  const tasks = [...(checklists.data ?? []), ...routineOnlyTasks].sort((left, right) => {
    const leftOrder = Number(left.sort_order ?? 0);
    const rightOrder = Number(right.sort_order ?? 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
  });

  return {
    today,
    slug,
    tasks,
    reminders: reminders.data ?? [],
    notifications: notifications.data ?? [],
    services: serviceCards.data ?? [],
    serviceSteps: serviceSteps.data ?? [],
    documents: documents.data ?? [],
    workTime: workDays.data ?? [],
    finance: finance.data ?? [],
  };
}

async function generateAgentSummary({
  agentName,
  systemPrompt,
  context,
}: {
  agentName: string;
  systemPrompt: string | null;
  context: unknown;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackSummary(agentName, context);

  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt ?? "Gere um resumo operacional curto."}\n\nDados JSON:\n${JSON.stringify(context).slice(0, 12000)}`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  return text || fallbackSummary(agentName, context);
}

function fallbackSummary(agentName: string, context: unknown) {
  const value = context as Partial<AgentContext> & { notifications?: unknown[]; serviceSteps?: unknown[] };
  if (value.slug === "briefing-matinal" && !value.tasks?.length && !value.reminders?.length && !value.notifications?.length) {
    return "Nenhuma tarefa, prazo ou pendencia encontrada para hoje.";
  }
  const taskTitles = listTitles(value.tasks, "title", 5);
  const reminderTitles = listTitles(value.reminders, "title", 5);
  const serviceTitles = listTitles(value.services, "title", 5);
  return [
    `${agentName}`,
    `Tarefas encontradas: ${value.tasks?.length ?? 0}.`,
    taskTitles.length ? `Principais tarefas: ${taskTitles.join("; ")}.` : null,
    `Lembretes encontrados: ${value.reminders?.length ?? 0}.`,
    reminderTitles.length ? `Lembretes: ${reminderTitles.join("; ")}.` : null,
    `Notificacoes abertas: ${value.notifications?.length ?? 0}.`,
    `Servicos considerados: ${value.services?.length ?? 0}.`,
    serviceTitles.length ? `Servicos em destaque: ${serviceTitles.join("; ")}.` : null,
    `Checklists de etapas considerados: ${value.serviceSteps?.length ?? 0}.`,
    `Documentos considerados: ${value.documents?.length ?? 0}.`,
    `Registros de expediente: ${value.workTime?.length ?? 0}.`,
    value.finance?.length ? `Lancamentos financeiros considerados: ${value.finance.length}.` : null,
    "Revise os itens listados no GeoGestao para priorizar o proximo passo.",
  ].filter(Boolean).join("\n");
}

function listTitles(items: Array<Record<string, unknown>> | undefined, key: string, limit: number) {
  return (items ?? [])
    .map((item) => String(item[key] ?? "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function buildAgentOutput({
  context,
  summary,
  generatedAt,
}: {
  context: Partial<AgentContext>;
  summary: string;
  generatedAt: string;
}): AgentOutput {
  const tasks = (context.tasks ?? []).slice(0, 20);
  const reminders = (context.reminders ?? []).slice(0, 20);
  const services = (context.services ?? []).slice(0, 20);
  const deadlines = services.filter((service) => service.due_date).slice(0, 10);
  const documentAlerts = (context.documents ?? []).filter((document) =>
    ["pendente", "erro", "precisa_ocr"].includes(String(document.processing_status ?? "")),
  );
  const priorities = [
    ...tasks.filter((task) => Boolean(task.is_emergency)).map((task) => String(task.title ?? "Tarefa urgente")),
    ...services.filter((service) => ["high", "urgent"].includes(String(service.priority))).map((service) => String(service.title ?? "Servico prioritario")),
  ].slice(0, 8);
  const warnings = [
    ...documentAlerts.map((document) => `Documento pendente: ${String(document.title ?? document.original_name ?? "Documento")}`),
  ].slice(0, 8);
  const nextActions = tasks.length
    ? tasks.slice(0, 5).map((task) => `Executar: ${String(task.title ?? "tarefa")}`)
    : ["Nenhuma tarefa, prazo ou pendencia encontrada para hoje."];

  return {
    summary,
    priorities,
    sections: [
      {
        title: "Tarefas",
        items: tasks.length ? tasks.map((task) => String(task.title ?? "Tarefa sem titulo")) : ["Nada urgente para hoje."],
      },
      {
        title: "Agenda e lembretes",
        items: reminders.length ? reminders.map((reminder) => String(reminder.title ?? "Lembrete")) : ["Sem lembretes relevantes."],
      },
      {
        title: "Servicos",
        items: services.length ? services.map((service) => String(service.title ?? "Servico")) : ["Sem servicos em destaque."],
      },
      {
        title: "Documentos",
        items: documentAlerts.length
          ? documentAlerts.map((document) => String(document.title ?? document.original_name ?? "Documento"))
          : ["Sem alertas de documentos."],
      },
    ],
    tasks,
    deadlines,
    warnings,
    nextActions,
    reminders,
    services,
    generatedAt,
  };
}

function preview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}
