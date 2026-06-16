import type { User } from "@supabase/supabase-js";
import { formatMemberCurrentWorkMessage, getMemberCurrentWorkStatusFromItems } from "@/lib/assistant/checklist-status";
import { normalizeAssistantDate } from "@/lib/assistant/date-normalizer";
import type { AssistantConfirmationPayload, AssistantIntentDetection, AssistantActionResult } from "@/lib/assistant/types";
import { normalizeAssistantText } from "@/lib/assistant/intent-detector";
import type { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDefaultChecklistItems, getInitialServiceColumn } from "@/lib/services/service-flow";
import { serviceTypeToBoardSlug } from "@/lib/services/service-cards";
import {
  filterServiceCardsByOperationalPeriod,
  isConcludedServiceColumn,
  isServiceOverdue,
} from "@/lib/services/service-period";
import type {
  Client,
  Contract,
  Json,
  Priority,
  Proposal,
  ProposalServiceType,
  ServiceCard,
  ServiceColumn,
} from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

type AssistantContext = {
  supabase: ServerSupabase;
  user: User;
  organizationId: string;
};

type ActionHandler = (
  context: AssistantContext,
  params: Record<string, Json>,
  confirmation?: AssistantConfirmationPayload,
) => Promise<AssistantActionResult>;

export const assistantActionRegistry: Record<string, ActionHandler> = {
  listTodayServices,
  listMonthServices,
  listOverdueServices,
  listPendingTasks,
  listInactiveClients,
  findClientByName,
  summarizeClient,
  createClientTask,
  createClientInteraction,
  createService,
  completeServiceStep,
  postponeServiceDueDate,
  listTodayChecklist,
  createChecklistItem,
  assignChecklistItem,
  listMemberActivity,
  listClientServices,
  listClientCommercialRecords,
};

export const intentToActionName: Record<string, string> = {
  list_today_services: "listTodayServices",
  list_month_services: "listMonthServices",
  list_overdue_services: "listOverdueServices",
  list_pending_tasks: "listPendingTasks",
  list_inactive_clients: "listInactiveClients",
  find_client_by_name: "findClientByName",
  summarize_client: "summarizeClient",
  create_client_task: "createClientTask",
  create_member_task: "assignChecklistItem",
  create_client_interaction: "createClientInteraction",
  create_service: "createService",
  complete_service_step: "completeServiceStep",
  postpone_service_due_date: "postponeServiceDueDate",
  list_today_checklist: "listTodayChecklist",
  list_member_checklist: "listMemberActivity",
  list_member_current_status: "listMemberActivity",
  create_checklist_item: "createChecklistItem",
  assign_checklist_item: "assignChecklistItem",
  list_member_activity: "listMemberActivity",
  list_member_tasks: "listMemberActivity",
  list_client_services: "listClientServices",
  list_client_commercial_records: "listClientCommercialRecords",
};

export async function executeAssistantIntent(
  context: AssistantContext,
  detection: AssistantIntentDetection,
  confirmation?: AssistantConfirmationPayload,
) {
  const actionName = confirmation?.actionName ?? intentToActionName[detection.intent];
  const handler = actionName ? assistantActionRegistry[actionName] : null;
  if (!handler) {
    return result({
      actionName: "unknown",
      input: detection.params,
      status: "ok",
      message:
        "Ainda nao entendi esse pedido. Posso listar servicos, tarefas, clientes sem movimentacao, resumo de cliente ou criar tarefa/interacao.",
    });
  }

  return handler(context, confirmation?.params ?? detection.params, confirmation);
}

async function listTodayServices(context: AssistantContext, params: Record<string, Json>) {
  const date = stringParam(params.date) ?? todayDate();
  const { cards, columnsById, clientsById } = await getServiceDataset(context);
  const items = filterServiceCardsByOperationalPeriod(
    cards,
    columnsById,
    { period: "custom", from: date, to: date },
    date,
  );
  return serviceListResult("listTodayServices", params, `Servicos para ${formatDate(date)}`, items, columnsById, clientsById);
}

async function listMonthServices(context: AssistantContext, params: Record<string, Json>) {
  const from = stringParam(params.from) ?? startOfCurrentMonth();
  const to = stringParam(params.to) ?? endOfCurrentMonth();
  const { cards, columnsById, clientsById } = await getServiceDataset(context);
  const items = filterServiceCardsByOperationalPeriod(
    cards,
    columnsById,
    { period: "custom", from, to },
  );
  return serviceListResult("listMonthServices", params, `Servicos do periodo ${formatDate(from)} a ${formatDate(to)}`, items, columnsById, clientsById);
}

async function listOverdueServices(context: AssistantContext, params: Record<string, Json>) {
  const today = todayDate();
  const { cards, columnsById, clientsById } = await getServiceDataset(context);
  const items = cards.filter((card) => isServiceOverdue(card, columnsById.get(card.column_id), today));
  return serviceListResult("listOverdueServices", params, "Servicos atrasados", items, columnsById, clientsById);
}

async function listPendingTasks(context: AssistantContext, params: Record<string, Json>) {
  const { data: assistantTasks, error: taskError } = await context.supabase
    .from("assistant_tasks")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("status", "pending")
    .order("due_date", { ascending: true });
  if (taskError) throw new Error(taskError.message);

  const { cards, clientsById } = await getServiceDataset(context);
  const serviceIds = cards.map((card) => card.id);
  const { data: checklists } = serviceIds.length
    ? await context.supabase.from("checklists").select("id,service_card_id,title").in("service_card_id", serviceIds)
    : { data: [] };
  const checklistIds = (checklists ?? []).map((item) => item.id);
  const { data: checklistItems } = checklistIds.length
    ? await context.supabase
        .from("checklist_items")
        .select("*")
        .in("checklist_id", checklistIds)
        .eq("is_done", false)
        .order("position")
    : { data: [] };
  const checklistById = new Map((checklists ?? []).map((item) => [item.id, item]));
  const cardById = new Map(cards.map((card) => [card.id, card]));

  const tasks = [
    ...(assistantTasks ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.due_date,
      client: task.client_id ? clientsById.get(task.client_id)?.name ?? null : null,
      source: "Assistente",
    })),
    ...(checklistItems ?? []).map((item) => {
      const checklist = checklistById.get(item.checklist_id);
      const card = checklist ? cardById.get(checklist.service_card_id) : null;
      return {
        id: item.id,
        title: item.title,
        dueDate: card?.due_date ?? null,
        client: card?.client_id ? clientsById.get(card.client_id)?.name ?? null : null,
        source: card ? `Checklist - ${card.title}` : "Checklist",
      };
    }),
  ];

  return result({
    actionName: "listPendingTasks",
    input: params,
    status: "ok",
    message: tasks.length
      ? `Encontrei ${tasks.length} tarefa(s) pendente(s).`
      : "Nao encontrei tarefas pendentes na organizacao atual.",
    data: { type: "tasks", items: tasks },
    output: { total: tasks.length },
  });
}

async function listInactiveClients(context: AssistantContext, params: Record<string, Json>) {
  const days = numberParam(params.days) ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);
  const clients = await listOrganizationClients(context);
  const { data: interactions, error } = await context.supabase
    .from("client_interactions")
    .select("client_id,occurred_at")
    .eq("organization_id", context.organizationId)
    .gte("occurred_at", sinceDate);
  if (error) throw new Error(error.message);

  const activeClientIds = new Set((interactions ?? []).map((item) => item.client_id));
  const inactive = clients
    .filter((client) => !activeClientIds.has(client.id))
    .map((client) => ({ id: client.id, name: client.name, document: client.document, phone: client.phone }));

  return result({
    actionName: "listInactiveClients",
    input: params,
    status: "ok",
    message: inactive.length
      ? `Encontrei ${inactive.length} cliente(s) sem movimentacao nos ultimos ${days} dias.`
      : `Nenhum cliente sem movimentacao nos ultimos ${days} dias.`,
    data: { type: "clients", items: inactive },
    output: { total: inactive.length, days },
  });
}

async function findClientByName(context: AssistantContext, params: Record<string, Json>) {
  const resolution = await resolveClient(context, params, undefined, "findClientByName");
  if (resolution.status === "needs_confirmation") return resolution.result;
  if (!resolution.client) {
    return result({
      actionName: "findClientByName",
      input: params,
      status: "ok",
      message: "Nao encontrei cliente com esse nome na organizacao atual.",
      data: { type: "clients", items: [] },
    });
  }

  return result({
    actionName: "findClientByName",
    input: params,
    status: "ok",
    message: `Encontrei o cliente ${resolution.client.name}.`,
    data: {
      type: "clients",
      items: [clientSummary(resolution.client)],
    },
  });
}

async function summarizeClient(context: AssistantContext, params: Record<string, Json>, confirmation?: AssistantConfirmationPayload) {
  const resolution = await resolveClient(context, params, confirmation, "summarizeClient");
  if (resolution.status === "needs_confirmation") return resolution.result;
  if (!resolution.client) return clientNotFound("summarizeClient", params);

  const client = resolution.client;
  const [services, interactions, tasks, proposals, contracts] = await Promise.all([
    getServicesForClient(context, client.id),
    getInteractionsForClient(context, client.id),
    getTasksForClient(context, client.id),
    getProposalsForClient(context, client.id),
    getContractsForClient(context, client.id),
  ]);

  return result({
    actionName: "summarizeClient",
    input: params,
    status: "ok",
    message: [
      `Resumo de ${client.name}:`,
      `${services.length} servico(s), ${proposals.length} proposta(s), ${contracts.length} contrato(s), ${tasks.length} tarefa(s) pendente(s).`,
      interactions[0] ? `Ultima interacao: ${formatDate(interactions[0].occurred_at)} - ${interactions[0].description}` : "Sem interacoes registradas.",
    ].join(" "),
    data: {
      type: "client_summary",
      client: clientSummary(client),
      services: summarizeServices(services, new Map()),
      interactions: interactions.slice(0, 5),
      tasks,
      proposals: summarizeProposals(proposals),
      contracts: summarizeContracts(contracts),
    },
  });
}

async function createClientTask(context: AssistantContext, params: Record<string, Json>, confirmation?: AssistantConfirmationPayload) {
  const resolution = await resolveClient(context, params, confirmation, "createClientTask");
  if (resolution.status === "needs_confirmation") return resolution.result;
  if (!resolution.client) return clientNotFound("createClientTask", params);

  const description = stringParam(params.description) ?? "Tarefa criada pela Sophia";
  const dueDateInput = stringParam(params.dueDate) ?? stringParam(params.date) ?? stringParam(params.data);
  const dueDate = dueDateInput ? normalizeAssistantDate(dueDateInput) : null;
  if (dueDateInput && !dueDate) {
    return result({
      actionName: "createClientTask",
      input: params,
      status: "ok",
      message: "Nao entendi a data. Voce quer criar para hoje, amanha ou outra data?",
      data: { type: "date_confirmation_needed", value: dueDateInput },
    });
  }
  const { data, error } = await context.supabase
    .from("assistant_tasks")
    .insert({
      organization_id: context.organizationId,
      user_id: context.user.id,
      client_id: resolution.client.id,
      title: description,
      description,
      due_date: dueDate,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return result({
    actionName: "createClientTask",
    input: params,
    status: "ok",
    message: `Tarefa criada para ${resolution.client.name}: ${description}.`,
    data: { type: "task_created", taskId: data.id, client: clientSummary(resolution.client) },
    output: { task_id: data.id },
  });
}

async function createClientInteraction(context: AssistantContext, params: Record<string, Json>, confirmation?: AssistantConfirmationPayload) {
  const resolution = await resolveClient(context, params, confirmation, "createClientInteraction");
  if (resolution.status === "needs_confirmation") return resolution.result;
  if (!resolution.client) return clientNotFound("createClientInteraction", params);

  const description = stringParam(params.description) ?? "Interacao criada pela Sophia";
  const dateInput = stringParam(params.date) ?? stringParam(params.dueDate) ?? stringParam(params.data);
  const occurredAt = dateInput ? normalizeAssistantDate(dateInput) : todayDate();
  if (!occurredAt) {
    return result({
      actionName: "createClientInteraction",
      input: params,
      status: "ok",
      message: "Nao entendi a data. Voce quer criar para hoje, amanha ou outra data?",
      data: { type: "date_confirmation_needed", value: dateInput },
    });
  }
  const { data, error } = await context.supabase
    .from("client_interactions")
    .insert({
      organization_id: context.organizationId,
      client_id: resolution.client.id,
      type: "nota",
      occurred_at: occurredAt,
      responsible_id: context.user.id,
      description,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return result({
    actionName: "createClientInteraction",
    input: params,
    status: "ok",
    message: `Interacao registrada em ${resolution.client.name}: ${description}.`,
    data: { type: "interaction_created", interactionId: data.id, client: clientSummary(resolution.client) },
    output: { interaction_id: data.id },
  });
}

async function createService(context: AssistantContext, params: Record<string, Json>) {
  const serviceType = parseServiceType(params.serviceType);
  const propertyName = stringParam(params.propertyName);
  const title = stringParam(params.title) ?? (propertyName ? `Imovel ${propertyName}` : null);
  const dueDateInput = stringParam(params.dueDate) ?? stringParam(params.prazo) ?? stringParam(params.date);
  const dueDate = dueDateInput ? normalizeAssistantDate(dueDateInput) ?? dueDateInput : null;
  const value = numberParam(params.value) ?? numberParam(params.amount);
  const priority = parsePriority(params.priority);
  const paymentStatus = stringParam(params.paymentStatus) === "pagamento_efetuado"
    ? "pagamento_efetuado"
    : "pagamento_nao_efetuado";

  if (!title) {
    return result({
      actionName: "createService",
      input: params,
      status: "ok",
      message: "Qual e o nome do imovel ou do servico?",
      data: { type: "missing_field", field: "propertyName" },
    });
  }
  if (!dueDate) {
    return result({
      actionName: "createService",
      input: params,
      status: "ok",
      message: "Qual e o prazo previsto do servico?",
      data: { type: "missing_field", field: "dueDate" },
    });
  }
  if (value === null || value <= 0) {
    return result({
      actionName: "createService",
      input: params,
      status: "ok",
      message: "Qual e o valor previsto do servico?",
      data: { type: "missing_field", field: "value" },
    });
  }

  const columnId = await resolveInitialServiceColumn(context, serviceType);
  const { data: card, error } = await context.supabase
    .from("service_cards")
    .insert({
      organization_id: context.organizationId,
      column_id: columnId,
      client_id: null,
      owner_id: context.user.id,
      service_type: serviceType,
      payment_status: paymentStatus,
      title,
      description: stringParam(params.description),
      priority,
      service_date: stringParam(params.serviceDate) ?? todayDate(),
      due_date: dueDate,
      custom_fields_json: {
        valor_previsto: value,
        tipo_servico: serviceType,
        imovel: propertyName,
        origem: "assistant",
      },
    })
    .select("id,title")
    .single();
  if (error) throw new Error(error.message);

  await createDefaultServiceChecklist(context, card.id, serviceType);
  await recordOrganizationActivity(context, {
    activityType: "service_created_by_assistant",
    entityType: "service",
    entityId: card.id,
    metadata: {
      title,
      service_type: serviceType,
      due_date: dueDate,
      value,
    },
  });

  return result({
    actionName: "createService",
    input: params,
    status: "ok",
    message: `Servico criado com sucesso: ${title}.`,
    data: {
      type: "service_created",
      serviceId: card.id,
      href: `/servicos/${card.id}`,
      title,
      serviceType,
      dueDate,
      value,
    },
    output: { service_id: card.id },
  });
}

async function completeServiceStep(
  context: AssistantContext,
  params: Record<string, Json>,
  confirmation?: AssistantConfirmationPayload,
) {
  const serviceName = stringParam(params.serviceName);
  const stepName = stringParam(params.stepName);
  if (!serviceName || !stepName) {
    return result({
      actionName: "completeServiceStep",
      input: params,
      status: "ok",
      message: "Informe o nome do servico e da etapa que deseja concluir.",
      data: { type: "missing_field" },
    });
  }

  const service = await findServiceByName(context, serviceName);
  if (!service) {
    return result({
      actionName: "completeServiceStep",
      input: params,
      status: "ok",
      message: `Nao encontrei servico parecido com "${serviceName}" nesta empresa.`,
      data: { type: "service_not_found", serviceName },
    });
  }

  const { data: checklists } = await context.supabase
    .from("checklists")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("service_card_id", service.id)
    .eq("checklist_type", "steps");
  const checklistIds = (checklists ?? []).map((checklist) => checklist.id);
  const { data: items } = checklistIds.length
    ? await context.supabase
        .from("checklist_items")
        .select("id,checklist_id,title,is_done")
        .in("checklist_id", checklistIds)
        .is("deleted_at", null)
        .is("archived_at", null)
    : { data: [] };
  const normalizedStep = normalizeAssistantText(stepName);
  const exact = (items ?? []).find((item) => normalizeAssistantText(item.title) === normalizedStep);
  const similar = (items ?? []).filter((item) => normalizeAssistantText(item.title).includes(normalizedStep) || normalizedStep.includes(normalizeAssistantText(item.title)));
  const target = exact ?? (similar.length === 1 ? similar[0] : null);

  if (!target) {
    const suggestions = (similar.length ? similar : items ?? []).slice(0, 5).map((item) => item.title);
    return result({
      actionName: "completeServiceStep",
      input: params,
      status: "ok",
      message: suggestions.length
        ? `Nao encontrei exatamente essa etapa. Itens parecidos em ${service.title}: ${suggestions.join(", ")}.`
        : `O servico ${service.title} nao possui etapas cadastradas.`,
      data: { type: "service_step_not_found", suggestions },
    });
  }

  if (!params.confirmed && !confirmation?.params?.confirmed) {
    return result({
      actionName: "completeServiceStep",
      input: params,
      status: "needs_confirmation",
      message: `Confirma marcar a etapa "${target.title}" do servico "${service.title}" como concluida?`,
      requiresConfirmation: true,
      confirmation: {
        actionName: "completeServiceStep",
        params: {
          ...params,
          serviceId: service.id,
          checklistItemId: target.id,
          checklistId: target.checklist_id,
          serviceName: service.title,
          stepName: target.title,
          confirmed: true,
        },
      },
    });
  }

  const checklistItemId = stringParam(params.checklistItemId) ?? target.id;
  const now = new Date().toISOString();
  const { error } = await context.supabase
    .from("checklist_items")
    .update({ is_done: true, completed_at: now, completed_by: context.user.id })
    .eq("id", checklistItemId)
    .eq("checklist_id", target.checklist_id);
  if (error) throw new Error(error.message);

  await refreshServiceChecklistPercent(context.supabase, service.id);
  await context.supabase
    .from("agenda_reminders")
    .update({ completed_at: now, canceled_at: now })
    .eq("organization_id", context.organizationId)
    .eq("entity_type", "service_card")
    .eq("entity_id", service.id)
    .ilike("title", `%${target.title}%`)
    .is("completed_at", null);
  await context.supabase.from("service_events").insert({
    organization_id: context.organizationId,
    service_card_id: service.id,
    event_type: "service.step_completed_by_sophia",
    title: "Etapa concluida pela Sophia",
    description: target.title,
    metadata: { checklist_item_id: checklistItemId },
    created_by: context.user.id,
  });

  return result({
    actionName: "completeServiceStep",
    input: params,
    status: "ok",
    message: `Etapa "${target.title}" do servico "${service.title}" marcada como concluida.`,
    data: { type: "service_step_completed", serviceId: service.id, checklistItemId },
  });
}

async function postponeServiceDueDate(
  context: AssistantContext,
  params: Record<string, Json>,
  confirmation?: AssistantConfirmationPayload,
) {
  const scope = stringParam(params.scope) === "bulk" ? "bulk" : "specific";
  const amount = numberParam(params.amount) ?? 1;
  const unit = parseDateUnit(stringParam(params.unit));
  const base = stringParam(params.base) === "today" ? "today" : "current_due_date";
  if (amount <= 0 || !unit) {
    return result({
      actionName: "postponeServiceDueDate",
      input: params,
      status: "ok",
      message: "Nao entendi o periodo. Use dias, semanas, meses ou anos.",
    });
  }

  const isOwner = await isOrganizationOwner(context);
  let services: ServiceCard[] = [];
  if (scope === "bulk") {
    if (!isOwner) {
      return result({
        actionName: "postponeServiceDueDate",
        input: params,
        status: "ok",
        message: "Apenas o owner pode alterar prazos de servicos em massa.",
      });
    }
    const serviceType = parseOptionalServiceType(stringParam(params.serviceType));
    if (!serviceType) {
      return result({
        actionName: "postponeServiceDueDate",
        input: params,
        status: "ok",
        message: "Informe o tipo de servico que deve ter o prazo adiado.",
      });
    }
    const { data, error } = await context.supabase
      .from("service_cards")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("service_type", serviceType);
    if (error) throw new Error(error.message);
    services = data ?? [];
  } else {
    const serviceName = stringParam(params.serviceName);
    if (!serviceName) {
      return result({
        actionName: "postponeServiceDueDate",
        input: params,
        status: "ok",
        message: "Informe o nome do servico que deve ter o prazo adiado.",
      });
    }
    const matches = await findServicesByText(context, serviceName);
    if (!matches.length) {
      return result({
        actionName: "postponeServiceDueDate",
        input: params,
        status: "ok",
        message: `Nao encontrei servico parecido com "${serviceName}" nesta empresa.`,
      });
    }
    if (matches.length > 1) {
      return result({
        actionName: "postponeServiceDueDate",
        input: params,
        status: "ok",
        message: `Encontrei mais de um servico parecido com "${serviceName}": ${matches.slice(0, 5).map((item) => item.title).join(", ")}. Informe um nome mais especifico.`,
        data: { type: "service_candidates", items: matches.slice(0, 5).map((item) => ({ id: item.id, title: item.title })) },
      });
    }
    const allowed = isOwner || await canUpdateServiceDueDate(context, matches[0]);
    if (!allowed) {
      return result({
        actionName: "postponeServiceDueDate",
        input: params,
        status: "ok",
        message: "Voce nao tem permissao para alterar esse servico.",
      });
    }
    services = matches;
  }

  if (!services.length) {
    return result({
      actionName: "postponeServiceDueDate",
      input: params,
      status: "ok",
      message: "Nao encontrei servicos para atualizar.",
    });
  }

  const updates = services.map((service) => {
    const baseDate = base === "today" || !service.due_date ? todayDate() : service.due_date;
    return {
      service,
      previousDueDate: service.due_date,
      nextDueDate: addToDate(baseDate, amount, unit),
    };
  });

  if (!params.confirmed && !confirmation?.params?.confirmed) {
    const serviceLabel = scope === "bulk"
      ? `${updates.length} servico(s) de ${serviceTypeLabel(stringParam(params.serviceType))}`
      : `o servico "${updates[0].service.title}"`;
    return result({
      actionName: "postponeServiceDueDate",
      input: params,
      status: "needs_confirmation",
      message: `Encontrei ${serviceLabel}. Vou alterar a data prevista em ${formatDateUnit(amount, unit)}. Confirma?`,
      requiresConfirmation: true,
      confirmation: {
        actionName: "postponeServiceDueDate",
        params: {
          ...params,
          serviceIds: updates.map((update) => update.service.id),
          confirmed: true,
        },
      },
    });
  }

  const now = new Date().toISOString();
  await Promise.all(updates.map((update) =>
    context.supabase
      .from("service_cards")
      .update({ due_date: update.nextDueDate })
      .eq("id", update.service.id)
      .eq("organization_id", context.organizationId),
  ));

  await context.supabase.from("service_events").insert(updates.map((update) => ({
    organization_id: context.organizationId,
    service_card_id: update.service.id,
    event_type: "service.due_date_updated_by_sophia",
    title: "Data prevista alterada pela Sophia",
    description: `${update.previousDueDate ?? "sem data"} -> ${update.nextDueDate}`,
    metadata: {
      previous_due_date: update.previousDueDate,
      next_due_date: update.nextDueDate,
      amount,
      unit,
      base,
    } as Json,
    created_by: context.user.id,
  })));

  await recordOrganizationActivity(context, {
    activityType: "service_due_date_updated_by_sophia",
    entityType: scope === "bulk" ? "service_cards" : "service_card",
    entityId: scope === "bulk" ? null : updates[0].service.id,
    metadata: {
      total: updates.length,
      service_ids: updates.map((update) => update.service.id),
      amount,
      unit,
      updated_at: now,
    } as Json,
  });

  return result({
    actionName: "postponeServiceDueDate",
    input: params,
    status: "ok",
    message: `Atualizei ${updates.length} servico(s). As datas previstas foram ajustadas em ${formatDateUnit(amount, unit)}.`,
    data: {
      type: "service_due_date_updated",
      items: updates.map((update) => ({
        id: update.service.id,
        title: update.service.title,
        previousDueDate: update.previousDueDate,
        nextDueDate: update.nextDueDate,
      })),
    },
    output: { total: updates.length },
  });
}

async function listTodayChecklist(context: AssistantContext, params: Record<string, Json>) {
  const date = stringParam(params.date) ?? todayDate();
  const memberName = stringParam(params.memberName);
  const member = memberName ? await resolveOrganizationMember(context, memberName) : { status: "ok" as const, userId: context.user.id, label: "voce" };
  if (member.status === "not_found") {
    return result({
      actionName: "listTodayChecklist",
      input: params,
      status: "ok",
      message: "Nao encontrei esse membro na organizacao atual.",
      data: { type: "members", items: [] },
    });
  }
  if (member.status === "multiple") {
    return result({
      actionName: "listTodayChecklist",
      input: params,
      status: "ok",
      message: `Encontrei mais de um membro parecido com "${memberName}". Informe o nome mais completo.`,
      data: { type: "members", items: member.candidates },
    });
  }

  const { checklist, items } = await getChecklistForUserDate(context, member.userId, date);
  const label = member.userId === context.user.id ? "seu checklist" : `checklist de ${member.label}`;
  const listedItems = items.map((item) => `- ${item.title} — ${item.status}`).join("\n");
  return result({
    actionName: "listTodayChecklist",
    input: params,
    status: "ok",
    message: items.length
      ? `Encontrei ${items.length} item(ns) em ${label} para ${formatDate(date)}.\n${listedItems}`
      : `Nao ha itens em ${label} para ${formatDate(date)}.`,
    data: {
      type: "daily_checklist",
      checklistId: checklist?.id ?? null,
      date,
      items: items.map(formatChecklistItem),
    },
    output: { total: items.length },
  });
}

async function createChecklistItem(context: AssistantContext, params: Record<string, Json>) {
  const title = stringParam(params.title) ?? stringParam(params.description);
  const date = stringParam(params.date) ?? todayDate();
  if (!title) {
    return result({
      actionName: "createChecklistItem",
      input: params,
      status: "ok",
      message: "Qual item voce quer adicionar ao checklist?",
      data: { type: "missing_field", field: "title" },
    });
  }
  const item = await insertChecklistItem(context, {
    assignedTo: context.user.id,
    title,
    date,
    isEmergency: booleanParam(params.isEmergency),
    source: "assistant",
  });
  return result({
    actionName: "createChecklistItem",
    input: params,
    status: "ok",
    message: `Item adicionado ao seu checklist de ${formatDate(date)}: ${title}.`,
    data: { type: "checklist_item_created", item: formatChecklistItem(item) },
    output: { item_id: item.id },
  });
}

async function assignChecklistItem(context: AssistantContext, params: Record<string, Json>, confirmation?: AssistantConfirmationPayload) {
  const isOwner = await isOrganizationOwner(context);
  if (!isOwner) {
    return result({
      actionName: "assignChecklistItem",
      input: params,
      status: "ok",
      message: "Apenas o proprietario da empresa pode atribuir tarefas para outro membro.",
    });
  }
  const memberName = stringParam(params.memberName) ?? stringParam(params.assignedToName);
  const title = stringParam(params.title) ?? stringParam(params.description);
  const date = stringParam(params.date) ?? todayDate();
  const selectedMemberId = stringParam(params.selectedMemberId) ?? confirmation?.selectedClientId ?? null;
  if ((!memberName && !selectedMemberId) || !title) {
    return result({
      actionName: "assignChecklistItem",
      input: params,
      status: "ok",
      message: "Informe o membro e o item que deve entrar no checklist.",
      data: { type: "missing_field", field: !memberName && !selectedMemberId ? "memberName" : "title" },
    });
  }
  const member = selectedMemberId
    ? await resolveOrganizationMemberById(context, selectedMemberId)
    : await resolveOrganizationMember(context, memberName ?? "");
  if (member.status !== "ok") {
    if (member.status === "multiple") {
      return result({
        actionName: "assignChecklistItem",
        input: params,
        status: "needs_confirmation",
        message: `Encontrei mais de um membro parecido com "${memberName}". Escolha qual e o correto.`,
        requiresConfirmation: true,
        confirmation: {
          actionName: "assignChecklistItem",
          params,
          candidates: member.candidates,
        },
        data: { type: "members", items: member.candidates },
        output: { candidates: member.candidates.length },
      });
    }
    return result({
      actionName: "assignChecklistItem",
      input: params,
      status: "ok",
      message: "Nao encontrei esse membro na organizacao atual. Tente informar o nome mais completo ou cadastrar esse membro na equipe.",
      data: { type: "members", items: [] },
    });
  }

  if (!params.confirmed) {
    return result({
      actionName: "assignChecklistItem",
      input: params,
      status: "needs_confirmation",
      message: `Vou adicionar este item ao checklist de ${member.label} para ${formatDate(date)}: ${title}. Confirma?`,
      requiresConfirmation: true,
      confirmation: {
        actionName: "assignChecklistItem",
        params: {
          ...params,
          memberName: member.label,
          selectedMemberId: member.userId,
          confirmed: true,
        },
      },
      data: { type: "member_task_pending", member: { id: member.userId, name: member.label }, title, date },
      output: { pending: true, assigned_to: member.userId },
    });
  }

  const item = await insertChecklistItem(context, {
    assignedTo: member.userId,
    title,
    date,
    isEmergency: booleanParam(params.isEmergency),
    source: "owner_assignment",
  });
  return result({
    actionName: "assignChecklistItem",
    input: params,
    status: "ok",
    message: `Item adicionado ao checklist de ${member.label} para ${formatDate(date)}: ${title}.`,
    data: { type: "checklist_item_created", item: formatChecklistItem(item) },
    output: { item_id: item.id, assigned_to: member.userId },
  });
}

async function listMemberActivity(context: AssistantContext, params: Record<string, Json>) {
  const memberName = stringParam(params.memberName);
  const memberId = stringParam(params.memberId);
  const date = stringParam(params.date) ?? todayDate();
  const member = memberId
    ? await resolveOrganizationMemberById(context, memberId)
    : memberName
      ? await resolveOrganizationMember(context, memberName)
      : { status: "ok" as const, userId: context.user.id, label: "voce" };
  if (member.status !== "ok") {
    return result({
      actionName: "listMemberActivity",
      input: params,
      status: "ok",
      message: member.status === "multiple"
        ? `Encontrei mais de um membro parecido com "${memberName}". Informe o nome mais completo.`
        : "Nao encontrei esse membro na organizacao atual.",
      data: { type: "members", items: member.status === "multiple" ? member.candidates : [] },
    });
  }

  const { items } = await getChecklistForUserDate(context, member.userId, date);
  const from = `${date}T00:00:00.000Z`;
  const toDate = new Date(`${date}T00:00:00.000Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const { data: activities, error } = await context.supabase
    .from("organization_activity_log")
    .select("*")
    .eq("organization_id", context.organizationId)
    .or(`actor_user_id.eq.${member.userId},target_user_id.eq.${member.userId}`)
    .gte("occurred_at", from)
    .lt("occurred_at", toDate.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);

  const openItems = items.filter((item) => item.status === "open");
  const doneItems = items.filter((item) => item.status === "done");
  const status = getMemberCurrentWorkStatusFromItems(items, activities ?? []);
  const label = member.userId === context.user.id ? "voce" : member.label;
  const dateLabel = formatDate(date);
  const lastActivityText = status.lastActivity ? formatActivityLogLine(status.lastActivity) : null;
  return result({
    actionName: "listMemberActivity",
    input: params,
    status: "ok",
    message: formatMemberCurrentWorkMessage({
      memberName: label,
      dateLabel,
      completedTitles: status.completedItems.map((item) => item.title),
      currentTitle: status.currentItem?.title ?? null,
      lastActivityText,
    }),
    data: {
      type: "member_activity",
      member: { id: member.userId, name: member.label },
      openItems: openItems.map(formatChecklistItem),
      doneItems: doneItems.map(formatChecklistItem),
      currentItem: status.currentItem ? formatChecklistItem(status.currentItem) : null,
      checklistDate: date,
      lastActivity: status.lastActivity ?? null,
      activities: activities ?? [],
    },
    output: { open: openItems.length, done: doneItems.length, activities: activities?.length ?? 0 },
  });
}

async function listClientServices(context: AssistantContext, params: Record<string, Json>, confirmation?: AssistantConfirmationPayload) {
  const resolution = await resolveClient(context, params, confirmation, "listClientServices");
  if (resolution.status === "needs_confirmation") return resolution.result;
  if (!resolution.client) return clientNotFound("listClientServices", params);
  const { columnsById } = await getServiceDataset(context);
  const services = await getServicesForClient(context, resolution.client.id);
  return serviceListResult("listClientServices", params, `Servicos do cliente ${resolution.client.name}`, services, columnsById, new Map([[resolution.client.id, resolution.client]]));
}

async function listClientCommercialRecords(context: AssistantContext, params: Record<string, Json>, confirmation?: AssistantConfirmationPayload) {
  const resolution = await resolveClient(context, params, confirmation, "listClientCommercialRecords");
  if (resolution.status === "needs_confirmation") return resolution.result;
  if (!resolution.client) return clientNotFound("listClientCommercialRecords", params);

  const [proposals, contracts] = await Promise.all([
    getProposalsForClient(context, resolution.client.id),
    getContractsForClient(context, resolution.client.id),
  ]);

  return result({
    actionName: "listClientCommercialRecords",
    input: params,
    status: "ok",
    message: `${resolution.client.name} tem ${proposals.length} proposta(s) e ${contracts.length} contrato(s).`,
    data: {
      type: "commercial_records",
      client: clientSummary(resolution.client),
      proposals: summarizeProposals(proposals),
      contracts: summarizeContracts(contracts),
    },
    output: { proposals: proposals.length, contracts: contracts.length },
  });
}

async function resolveClient(
  context: AssistantContext,
  params: Record<string, Json>,
  confirmation?: AssistantConfirmationPayload,
  actionName = "findClientByName",
): Promise<
  | { status: "ok"; client: Client | null }
  | { status: "needs_confirmation"; result: AssistantActionResult }
> {
  if (confirmation?.selectedClientId) {
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("id", confirmation.selectedClientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { status: "ok", client: data ?? null };
  }

  const clientName = stringParam(params.clientName) ?? stringParam(params.client_name);
  if (!clientName) return { status: "ok", client: null };
  const matches = await findClientsByApproxName(context, clientName);
  if (matches.length === 1) return { status: "ok", client: matches[0] };
  if (matches.length > 1) {
    const candidates = matches.slice(0, 5).map((client) => ({
      id: client.id,
      label: client.name,
      description: client.document,
    }));
    return {
      status: "needs_confirmation",
      result: result({
        actionName: "confirmClient",
        input: params,
        status: "needs_confirmation",
        message: `Encontrei mais de um cliente parecido com "${clientName}". Qual deles devo usar?`,
        requiresConfirmation: true,
        confirmation: {
          actionName,
          params: { ...params, actionName },
          candidates,
        },
        data: { type: "client_candidates", items: candidates },
      }),
    };
  }

  return { status: "ok", client: null };
}

async function findClientsByApproxName(context: AssistantContext, name: string) {
  const clients = await listOrganizationClients(context);
  const normalized = normalizeAssistantText(name);
  const exact = clients.filter((client) => normalizeAssistantText(client.name) === normalized);
  if (exact.length) return exact;
  const queryTokens = normalized.split(/\s+/).filter((token) => token.length > 1);
  return clients.filter((client) => {
    const clientName = normalizeAssistantText(client.name);
    const clientTokens = clientName.split(/\s+/).filter((token) => token.length > 1);
    return (
      clientName.includes(normalized) ||
      normalized.includes(clientName) ||
      queryTokens.every((token) => clientTokens.some((clientToken) => clientToken.startsWith(token) || clientToken === token))
    );
  });
}

async function listOrganizationClients(context: AssistantContext) {
  const { data, error } = await context.supabase
    .from("clients")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getServiceDataset(context: AssistantContext) {
  const [cardsResult, columnsResult, clientsResult] = await Promise.all([
    context.supabase
      .from("service_cards")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false }),
    context.supabase.from("service_columns").select("*"),
    context.supabase.from("clients").select("*").eq("organization_id", context.organizationId),
  ]);
  if (cardsResult.error) throw new Error(cardsResult.error.message);
  if (columnsResult.error) throw new Error(columnsResult.error.message);
  if (clientsResult.error) throw new Error(clientsResult.error.message);

  return {
    cards: cardsResult.data ?? [],
    columnsById: new Map((columnsResult.data ?? []).map((column) => [column.id, column])),
    clientsById: new Map((clientsResult.data ?? []).map((client) => [client.id, client])),
  };
}

async function getServicesForClient(context: AssistantContext, clientId: string) {
  const { data, error } = await context.supabase
    .from("service_cards")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getInteractionsForClient(context: AssistantContext, clientId: string) {
  const { data, error } = await context.supabase
    .from("client_interactions")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId)
    .order("occurred_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getTasksForClient(context: AssistantContext, clientId: string) {
  const { data, error } = await context.supabase
    .from("assistant_tasks")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId)
    .eq("status", "pending")
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getProposalsForClient(context: AssistantContext, clientId: string) {
  const { data, error } = await context.supabase
    .from("proposals")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getContractsForClient(context: AssistantContext, clientId: string) {
  const { data, error } = await context.supabase
    .from("contracts")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function findServiceByName(context: AssistantContext, serviceName: string) {
  const normalized = normalizeAssistantText(serviceName);
  const { data, error } = await context.supabase
    .from("service_cards")
    .select("id,title")
    .eq("organization_id", context.organizationId)
    .ilike("title", `%${serviceName}%`)
    .limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []).find((service) => normalizeAssistantText(service.title) === normalized) ?? data?.[0] ?? null;
}

async function refreshServiceChecklistPercent(supabase: ServerSupabase, serviceCardId: string) {
  const { data: checklists } = await supabase
    .from("checklists")
    .select("id")
    .eq("service_card_id", serviceCardId)
    .eq("checklist_type", "steps");
  const checklistIds = (checklists ?? []).map((checklist) => checklist.id);
  if (!checklistIds.length) {
    await supabase.from("service_cards").update({ checklist_percent: 0 }).eq("id", serviceCardId);
    return;
  }
  const { data: items } = await supabase
    .from("checklist_items")
    .select("is_done")
    .in("checklist_id", checklistIds)
    .is("deleted_at", null)
    .is("archived_at", null);
  const total = items?.length ?? 0;
  const done = (items ?? []).filter((item) => item.is_done).length;
  await supabase
    .from("service_cards")
    .update({ checklist_percent: total ? Number(((done / total) * 100).toFixed(2)) : 0 })
    .eq("id", serviceCardId);
}

function serviceListResult(
  actionName: string,
  input: Record<string, Json>,
  title: string,
  services: ServiceCard[],
  columnsById: Map<string, Pick<ServiceColumn, "slug" | "name">>,
  clientsById: Map<string, Pick<Client, "id" | "name">>,
) {
  const items = summarizeServices(services, columnsById, clientsById);
  return result({
    actionName,
    input,
    status: "ok",
    message: items.length ? `${title}: encontrei ${items.length} servico(s).` : `${title}: nenhum servico encontrado.`,
    data: { type: "services", items },
    output: { total: items.length },
  });
}

function summarizeServices(
  services: ServiceCard[],
  columnsById: Map<string, Pick<ServiceColumn, "slug" | "name">>,
  clientsById = new Map<string, Pick<Client, "id" | "name">>(),
) {
  return services.map((service) => {
    const column = columnsById.get(service.column_id);
    return {
      id: service.id,
      title: service.title,
      client: service.client_id ? clientsById.get(service.client_id)?.name ?? "Cliente vinculado" : "Sem cliente",
      stage: column?.name ?? "Sem etapa",
      dueDate: service.due_date,
      serviceDate: service.service_date ?? service.created_at?.slice(0, 10),
      paymentStatus: service.payment_status,
      priority: service.priority,
      overdue: isServiceOverdue(service, column),
      concluded: isConcludedServiceColumn(column),
    };
  });
}

function summarizeProposals(proposals: Proposal[]) {
  return proposals.map((proposal) => ({
    id: proposal.id,
    title: proposal.title,
    stage: proposal.stage,
    value: proposal.value ? formatCurrency(proposal.value) : null,
    validUntil: proposal.valid_until,
  }));
}

function summarizeContracts(contracts: Contract[]) {
  return contracts.map((contract) => ({
    id: contract.id,
    title: contract.title,
    status: contract.status,
    amount: contract.amount ? formatCurrency(contract.amount) : null,
    signedAt: contract.signed_at,
  }));
}

function clientSummary(client: Client) {
  return {
    id: client.id,
    name: client.name,
    document: client.document,
    email: client.email,
    phone: client.phone,
  };
}

function clientNotFound(actionName: string, input: Record<string, Json>) {
  return result({
    actionName,
    input,
    status: "ok",
    message: "Nao encontrei esse cliente na organizacao atual. Tente informar o nome mais completo.",
    data: { type: "clients", items: [] },
  });
}

async function resolveInitialServiceColumn(
  context: AssistantContext,
  serviceType: ProposalServiceType,
) {
  const boardSlug = serviceTypeToBoardSlug[serviceType];
  const { data: board, error: boardError } = await context.supabase
    .from("service_boards")
    .select("id")
    .eq("slug", boardSlug)
    .maybeSingle();
  if (boardError) throw new Error(boardError.message);
  if (!board?.id) throw new Error("Quadro de servico nao encontrado.");

  const { data: columns, error: columnsError } = await context.supabase
    .from("service_columns")
    .select("*")
    .eq("board_id", board.id)
    .order("position");
  if (columnsError) throw new Error(columnsError.message);

  const column = getInitialServiceColumn(columns ?? []);
  if (!column) throw new Error("Coluna inicial de servico nao encontrada.");
  return column.id;
}

async function createDefaultServiceChecklist(
  context: AssistantContext,
  serviceCardId: string,
  serviceType: ProposalServiceType,
) {
  const { data: checklist, error } = await context.supabase
    .from("checklists")
    .insert({
      service_card_id: serviceCardId,
      title: "Checklist padrao",
      position: 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const items = getDefaultChecklistItems(serviceType).map((title, index) => ({
    checklist_id: checklist.id,
    title,
    position: index + 1,
    is_done: false,
  }));
  if (items.length) {
    const { error: itemsError } = await context.supabase.from("checklist_items").insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }
}

async function getChecklistForUserDate(context: AssistantContext, userId: string, date: string) {
  const { data: checklist, error: checklistError } = await context.supabase
    .from("daily_checklists")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("user_id", userId)
    .eq("checklist_date", date)
    .maybeSingle();
  if (checklistError) throw new Error(checklistError.message);

  let itemsQuery = context.supabase
    .from("daily_checklist_items")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("assigned_to", userId)
    .in("status", ["open", "done"])
    .is("deleted_at", null)
    .is("archived_at", null);
  const dateOrChecklist = [`due_date.lte.${date}`];
  if (checklist?.id) dateOrChecklist.push(`checklist_id.eq.${checklist.id}`);
  itemsQuery = itemsQuery.or(dateOrChecklist.join(","));
  const { data: rawItems, error } = await itemsQuery
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const items = (rawItems ?? []).filter((item) => {
    if (item.status === "open") return !item.due_date || item.due_date <= date;
    return item.due_date === date || item.completed_at?.slice(0, 10) === date;
  });
  return { checklist: checklist ?? null, items };
}

async function ensureDailyChecklist(context: AssistantContext, userId: string, date: string) {
  const { data: existing, error: existingError } = await context.supabase
    .from("daily_checklists")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("user_id", userId)
    .eq("checklist_date", date)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const { data, error } = await context.supabase
    .from("daily_checklists")
    .insert({
      organization_id: context.organizationId,
      user_id: userId,
      checklist_date: date,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function insertChecklistItem(
  context: AssistantContext,
  {
    assignedTo,
    title,
    date,
    isEmergency,
    source,
  }: {
    assignedTo: string;
    title: string;
    date: string;
    isEmergency: boolean;
    source: "self" | "owner_assignment" | "assistant";
  },
) {
  const checklist = await ensureDailyChecklist(context, assignedTo, date);
  const sortOrder = await nextChecklistSortOrder(context, assignedTo);
  const { data, error } = await context.supabase
    .from("daily_checklist_items")
    .insert({
      checklist_id: checklist.id,
      organization_id: context.organizationId,
      assigned_to: assignedTo,
      created_by: context.user.id,
      title,
      due_date: date,
      is_emergency: isEmergency,
      source,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await recordOrganizationActivity(context, {
    activityType: assignedTo === context.user.id ? "checklist_item_created" : "checklist_item_assigned",
    targetUserId: assignedTo,
    entityType: "daily_checklist_item",
    entityId: data.id,
    metadata: { title, date, is_emergency: isEmergency, source },
  });
  await context.supabase.from("routine_items").insert({
    organization_id: context.organizationId,
    user_id: assignedTo,
    title,
    description: null,
    routine_scope: "daily",
    routine_date: date,
    is_emergency: isEmergency,
    source,
    daily_checklist_item_id: data.id,
    created_by: context.user.id,
    sort_order: sortOrder,
  });
  return data;
}

async function nextChecklistSortOrder(context: AssistantContext, assignedTo: string) {
  const { data } = await context.supabase
    .from("daily_checklist_items")
    .select("sort_order")
    .eq("organization_id", context.organizationId)
    .eq("assigned_to", assignedTo)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);
  return Number(data?.[0]?.sort_order ?? 0) + 1000;
}

async function resolveOrganizationMember(context: AssistantContext, name: string): Promise<
  | { status: "ok"; userId: string; label: string }
  | { status: "not_found" }
  | { status: "multiple"; candidates: Array<{ id: string; label: string; description?: string | null }> }
> {
  const { data: members, error: memberError } = await context.supabase
    .from("organization_members")
    .select("user_id,role,status")
    .eq("organization_id", context.organizationId)
    .eq("status", "active");
  if (memberError) throw new Error(memberError.message);

  const userIds = (members ?? []).map((member) => member.user_id);
  if (!userIds.length) return { status: "not_found" };
  const { data: profiles, error: profileError } = await context.supabase
    .from("profiles")
    .select("id,full_name,email")
    .in("id", userIds);
  if (profileError) throw new Error(profileError.message);

  const normalized = normalizeAssistantText(name);
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 2);
  const matches = (profiles ?? []).filter((profile) => {
    const fullName = normalizeAssistantText(profile.full_name ?? "");
    const email = normalizeAssistantText(profile.email ?? "");
    const nameTokens = fullName.split(/\s+/).filter(Boolean);
    const tokenMatch = tokens.length > 0 && tokens.every((token) =>
      nameTokens.some((nameToken) => nameToken === token || nameToken.startsWith(token)) ||
      email.includes(token)
    );
    return fullName.includes(normalized) || normalized.includes(fullName) || email.includes(normalized) || tokenMatch;
  });
  if (matches.length === 1) {
    return {
      status: "ok",
      userId: matches[0].id,
      label: matches[0].full_name ?? matches[0].email ?? "Membro",
    };
  }
  if (matches.length > 1) {
    return {
      status: "multiple",
      candidates: matches.slice(0, 5).map((profile) => ({
        id: profile.id,
        label: profile.full_name ?? profile.email ?? "Membro",
        description: profile.email,
      })),
    };
  }

  const { data: teamMembers, error: teamError } = await context.supabase
    .from("team_members")
    .select("id,name,email,auth_user_id,status")
    .eq("organization_id", context.organizationId)
    .eq("status", "active");
  if (!teamError) {
    const teamMatches = (teamMembers ?? []).filter((member) => {
      const fullName = normalizeAssistantText(member.name ?? "");
      const email = normalizeAssistantText(member.email ?? "");
      const nameTokens = fullName.split(/\s+/).filter(Boolean);
      const tokenMatch = tokens.length > 0 && tokens.every((token) =>
        nameTokens.some((nameToken) => nameToken === token || nameToken.startsWith(token)) || email.includes(token)
      );
      return fullName.includes(normalized) ||
        normalized.includes(fullName) ||
        tokenMatch;
    });
    const linkedMatches = teamMatches.filter((member) => member.auth_user_id);
    if (linkedMatches.length === 1 && linkedMatches[0].auth_user_id) {
      return {
        status: "ok",
        userId: linkedMatches[0].auth_user_id,
        label: linkedMatches[0].name ?? linkedMatches[0].email ?? "Membro",
      };
    }
    if (linkedMatches.length > 1) {
      return {
        status: "multiple",
        candidates: linkedMatches.slice(0, 5).map((member) => ({
          id: member.auth_user_id ?? member.id,
          label: member.name ?? member.email ?? "Membro",
          description: member.email,
        })),
      };
    }
  }
  return { status: "not_found" };
}

async function resolveOrganizationMemberById(context: AssistantContext, userId: string): Promise<
  | { status: "ok"; userId: string; label: string }
  | { status: "not_found" }
  | { status: "multiple"; candidates: Array<{ id: string; label: string; description?: string | null }> }
> {
  const { data: member, error: memberError } = await context.supabase
    .from("organization_members")
    .select("user_id,status")
    .eq("organization_id", context.organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member) return { status: "not_found" };

  const { data: profile, error: profileError } = await context.supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  return {
    status: "ok",
    userId,
    label: profile?.full_name ?? profile?.email ?? "Membro",
  };
}

async function isOrganizationOwner(context: AssistantContext) {
  const { data, error } = await context.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", context.organizationId)
    .eq("user_id", context.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.role === "owner";
}

async function recordOrganizationActivity(
  context: AssistantContext,
  {
    activityType,
    targetUserId = null,
    entityType = null,
    entityId = null,
    metadata = {},
  }: {
    activityType: string;
    targetUserId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Json;
  },
) {
  const { error } = await context.supabase.from("organization_activity_log").insert({
    organization_id: context.organizationId,
    actor_user_id: context.user.id,
    target_user_id: targetUserId,
    activity_type: activityType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error && !isMissingRelation(error.message)) throw new Error(error.message);
}

function formatChecklistItem(item: {
  id: string;
  title: string;
  status: string;
  is_emergency: boolean;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string;
  assigned_to: string;
  sort_order?: number | null;
}) {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    emergency: item.is_emergency,
    dueDate: item.due_date,
    createdAt: item.created_at,
    completedAt: item.completed_at,
    createdBy: item.created_by,
    assignedTo: item.assigned_to,
    sortOrder: item.sort_order ?? 0,
  };
}

function formatActivityLogLine(activity: {
  activity_type: string;
  metadata: Json;
  occurred_at: string;
}) {
  const title = typeof activity.metadata === "object" && activity.metadata !== null && !Array.isArray(activity.metadata)
    ? stringParam((activity.metadata as Record<string, Json>).title)
    : null;
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(activity.occurred_at));

  if (activity.activity_type === "checklist_item_completed") return `marcou ${title ?? "um item"} como concluido as ${time}`;
  if (activity.activity_type === "checklist_item_created") return `criou ${title ?? "um item"} as ${time}`;
  if (activity.activity_type === "checklist_item_reopened") return `reabriu ${title ?? "um item"} as ${time}`;
  if (activity.activity_type === "checklist_item_assigned") return `recebeu ${title ?? "um item"} as ${time}`;
  return `${activity.activity_type} as ${time}`;
}

function parseDateUnit(value: string | null) {
  if (value === "day" || value === "week" || value === "month" || value === "year") return value;
  return null;
}

function addToDate(dateKey: string, amount: number, unit: "day" | "week" | "month" | "year") {
  const date = new Date(`${dateKey}T00:00:00-03:00`);
  if (unit === "day") date.setDate(date.getDate() + amount);
  if (unit === "week") date.setDate(date.getDate() + amount * 7);
  if (unit === "month") date.setMonth(date.getMonth() + amount);
  if (unit === "year") date.setFullYear(date.getFullYear() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateUnit(amount: number, unit: "day" | "week" | "month" | "year") {
  const labels = {
    day: amount === 1 ? "1 dia" : `${amount} dias`,
    week: amount === 1 ? "1 semana" : `${amount} semanas`,
    month: amount === 1 ? "1 mes" : `${amount} meses`,
    year: amount === 1 ? "1 ano" : `${amount} anos`,
  };
  return labels[unit];
}

function parseOptionalServiceType(value: string | null): ProposalServiceType | null {
  if (
    value === "georreferenciamento" ||
    value === "car" ||
    value === "itr_ccir" ||
    value === "outros_servicos"
  ) {
    return value;
  }
  return null;
}

function serviceTypeLabel(value: string | null) {
  if (value === "itr_ccir") return "ITR/CCIR";
  if (value === "car") return "CAR";
  if (value === "georreferenciamento") return "Georreferenciamento";
  if (value === "outros_servicos") return "Outros Servicos";
  return "servicos";
}

async function findServicesByText(context: AssistantContext, search: string) {
  const { cards, clientsById } = await getServiceDataset(context);
  const normalized = normalizeAssistantText(search);
  const scored = cards
    .map((card) => {
      const clientName = card.client_id ? clientsById.get(card.client_id)?.name ?? "" : "";
      const haystack = normalizeAssistantText([
        card.title,
        card.description,
        card.municipality,
        clientName,
      ].filter(Boolean).join(" "));
      const exact = normalizeAssistantText(card.title) === normalized;
      const includes = haystack.includes(normalized) || normalized.includes(normalizeAssistantText(card.title));
      const tokens = normalized.split(/\s+/).filter((token) => token.length > 1);
      const tokenMatch = tokens.length > 0 && tokens.every((token) => haystack.includes(token));
      return { card, score: exact ? 3 : includes ? 2 : tokenMatch ? 1 : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.card.title.localeCompare(b.card.title));
  const bestScore = scored[0]?.score ?? 0;
  return scored.filter((item) => item.score === bestScore).map((item) => item.card).slice(0, 10);
}

async function canUpdateServiceDueDate(context: AssistantContext, service: Pick<ServiceCard, "id" | "responsible_user_id">) {
  if (service.responsible_user_id === context.user.id) return true;
  const { data, error } = await context.supabase
    .from("service_members")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("service_card_id", service.id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

function parseServiceType(value: Json | undefined): ProposalServiceType {
  if (
    value === "georreferenciamento" ||
    value === "car" ||
    value === "itr_ccir" ||
    value === "outros_servicos"
  ) {
    return value;
  }
  return "outros_servicos";
}

function parsePriority(value: Json | undefined): Priority {
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") return value;
  return "medium";
}

function result(payload: AssistantActionResult): AssistantActionResult {
  if (payload.confirmation?.params) {
    payload.confirmation.params = {
      ...payload.confirmation.params,
      actionName: payload.actionName === "confirmClient" ? payload.confirmation.actionName : payload.actionName,
    };
  }
  return payload;
}

function stringParam(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberParam(value: Json | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanParam(value: Json | undefined) {
  return typeof value === "boolean" ? value : false;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function endOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0, 10);
}

function isMissingRelation(message: string) {
  return /relation .*organization_activity_log/i.test(message) || /Could not find .*organization_activity_log/i.test(message);
}
