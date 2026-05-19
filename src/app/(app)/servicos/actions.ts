"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import {
  clientSchema,
  checklistItemSchema,
  checklistSchema,
  serviceCardSchema,
} from "@/lib/schemas";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import {
  getDefaultChecklistItems,
  getExecutionColumn,
  getNextColumn,
  getProposalContractColumn,
  getInitialServiceColumn,
} from "@/lib/services/service-flow";
import {
  getServiceEstimatedValue,
  isPaidService,
  isServiceLostColumn,
} from "@/lib/services/service-finance";
import { serviceTypeToBoardSlug } from "@/lib/services/service-cards";
import { createServerSupabase } from "@/lib/supabase/server";
import { revertServiceToProposal as revertServiceToProposalAction } from "@/app/(app)/propostas/actions";
import type { Json, PaymentStatus, Priority, ProposalServiceType, ServiceCard, ServiceColumn } from "@/types/database";

export async function revertServiceToProposal(cardId: string) {
  return revertServiceToProposalAction(cardId);
}

export async function createServiceCardAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = serviceCardSchema.parse(formDataToObject(formData));
  const serviceType = parsed.service_type ?? "georreferenciamento";
  const initialColumnId = await resolveInitialColumnForServiceType(
    supabase,
    serviceType,
    parsed.column_id,
  );

  if (process.env.NODE_ENV !== "production") {
    console.info("[servicos:create]", {
      userId: user.id,
      organizationId: organization.id,
      serviceType,
      initialColumnId,
      serviceValue: getServiceEstimatedValue({
        custom_fields_json: parsed.custom_fields_json,
      } as Pick<ServiceCard, "custom_fields_json">),
      paymentStatus: parsed.payment_status ?? "pagamento_nao_efetuado",
    });
  }

  const { data, error } = await supabase
    .from("service_cards")
    .insert({
      ...parsed,
      column_id: initialColumnId,
      organization_id: organization.id,
      service_type: serviceType,
      payment_status: parsed.payment_status ?? "pagamento_nao_efetuado",
      owner_id: user.id,
    })
    .select("id,service_type")
    .single();

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[servicos:create] insert failed", {
        organizationId: organization.id,
        serviceType,
        initialColumnId,
        message: error.message,
      });
    }
    throw new Error(error.message);
  }
  await createDefaultChecklistForService(
    supabase,
    data.id,
    data.service_type ?? parsed.service_type ?? "outros_servicos",
  );
  await recordServiceEvent(supabase, {
    organizationId: organization.id,
    serviceCardId: data.id,
    userId: user.id,
    eventType: "service.created",
    title: "Servico criado",
  });
  await logAudit(supabase, {
    action: "service_card.created",
    entityType: "service_card",
    entityId: data.id,
  });
  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: data.id,
    userId: user.id,
  });

  revalidatePath("/servicos");
  revalidatePath("/financeiro");
  return { ok: true, serviceCardId: data.id, columnId: initialColumnId, serviceType };
}

export async function moveServiceCardAction(cardId: string, toColumnId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);

  const { data: current, error: currentError } = await supabase
    .from("service_cards")
    .select("column_id,organization_id")
    .eq("id", cardId)
    .single();
  if (currentError) throw new Error(currentError.message);

  await moveCardToColumn(supabase, {
    cardId,
    fromColumnId: current.column_id,
    toColumnId,
    userId: user.id,
    organizationId: current.organization_id,
    eventTitle: "Servico movido",
  });

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
  revalidatePath("/financeiro");
}

export async function completeServiceDocumentationAction(cardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getServiceColumnContext(supabase, cardId);
  const target = getProposalContractColumn(context.columns);
  if (!target) throw new Error("Coluna Proposta/Contrato nao encontrada.");

  await moveCardToColumn(supabase, {
    cardId,
    fromColumnId: context.card.column_id,
    toColumnId: target.id,
    userId: user.id,
    organizationId: context.card.organization_id,
    eventTitle: "Documentacao concluida",
  });

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
  revalidatePath("/financeiro");
}

export async function moveServiceToExecutionAction(cardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getServiceColumnContext(supabase, cardId);
  const target = getExecutionColumn(context.columns, context.card.priority);
  if (!target) throw new Error("Coluna de execucao nao encontrada.");

  await moveCardToColumn(supabase, {
    cardId,
    fromColumnId: context.card.column_id,
    toColumnId: target.id,
    userId: user.id,
    organizationId: context.card.organization_id,
    eventTitle: "Servico enviado para execucao",
  });

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
  revalidatePath("/financeiro");
}

export async function advanceServiceCardAction(cardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getServiceColumnContext(supabase, cardId);
  const target = getNextColumn(context.columns, context.card.column_id);
  if (!target || target.id === context.card.column_id) {
    return { ok: true, message: "Servico ja esta na ultima coluna." };
  }

  await moveCardToColumn(supabase, {
    cardId,
    fromColumnId: context.card.column_id,
    toColumnId: target.id,
    userId: user.id,
    organizationId: context.card.organization_id,
    eventTitle: "Servico avancou etapa",
  });

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
  return { ok: true, message: `Servico movido para ${target.name}.` };
}

export async function updateServiceStageAction(cardId: string, columnId: string) {
  await moveServiceCardAction(cardId, columnId);
}

export async function updateServicePriorityAction(cardId: string, priority: Priority) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { data: card, error: cardError } = await supabase
    .from("service_cards")
    .select("organization_id")
    .eq("id", cardId)
    .single();
  if (cardError) throw new Error(cardError.message);

  const { error } = await supabase.from("service_cards").update({ priority }).eq("id", cardId);
  if (error) throw new Error(error.message);

  await recordServiceEvent(supabase, {
    organizationId: card.organization_id,
    serviceCardId: cardId,
    userId: user.id,
    eventType: "service.priority_changed",
    title: "Prioridade alterada",
    metadata: { priority },
  });
  await logAudit(supabase, {
    action: "service_card.priority_changed",
    entityType: "service_card",
    entityId: cardId,
    metadata: { priority },
  });
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
}

export async function updateServicePaymentStatusAction(
  cardId: string,
  paymentStatus: PaymentStatus,
) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { data: card, error: cardError } = await supabase
    .from("service_cards")
    .select("organization_id")
    .eq("id", cardId)
    .single();
  if (cardError) throw new Error(cardError.message);

  const { error } = await supabase
    .from("service_cards")
    .update({ payment_status: paymentStatus })
    .eq("id", cardId);
  if (error) throw new Error(error.message);
  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: cardId,
    userId: user.id,
  });

  await recordServiceEvent(supabase, {
    organizationId: card.organization_id,
    serviceCardId: cardId,
    userId: user.id,
    eventType: "service.payment_changed",
    title: "Pagamento atualizado",
    metadata: { payment_status: paymentStatus },
  });
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
  revalidatePath("/financeiro");
}

export async function createClientForServiceAction(cardId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = clientSchema.parse(formDataToObject(formData));

  const { data: client, error } = await supabase
    .from("clients")
    .insert({ ...parsed, organization_id: organization.id, created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: cardError } = await supabase
    .from("service_cards")
    .update({ client_id: client.id })
    .eq("id", cardId)
    .eq("organization_id", organization.id);
  if (cardError) throw new Error(cardError.message);
  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: cardId,
    userId: user.id,
  });

  await recordServiceEvent(supabase, {
    organizationId: organization.id,
    serviceCardId: cardId,
    userId: user.id,
    eventType: "service.client_created",
    title: "Cliente cadastrado e vinculado",
    metadata: { client_id: client.id },
  });

  revalidatePath("/clientes");
  revalidatePath("/minha-empresa");
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
  revalidatePath("/financeiro");
  return { ok: true, clientId: client.id };
}

export async function createProposalForServiceAction(cardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const card = await getServiceCardForOrganization(supabase, cardId, organization.id);
  if (card.proposal_id) return { ok: true, proposalId: card.proposal_id };
  if (!card.client_id) throw new Error("Cadastre ou vincule um cliente antes de criar a proposta.");

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      organization_id: organization.id,
      client_id: card.client_id,
      title: `Proposta - ${card.title}`,
      description: card.description,
      service_type: card.service_type ?? "georreferenciamento",
      valid_until: card.due_date,
      stage: "todo",
      owner_id: user.id,
      payment_status: card.payment_status ?? "pagamento_nao_efetuado",
      service_card_id: card.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("service_cards").update({ proposal_id: data.id }).eq("id", card.id);
  await recordServiceEvent(supabase, {
    organizationId: organization.id,
    serviceCardId: card.id,
    userId: user.id,
    eventType: "service.proposal_created",
    title: "Proposta criada",
    metadata: { proposal_id: data.id },
  });
  revalidatePath("/propostas");
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${card.id}`);
  return { ok: true, proposalId: data.id };
}

export async function createContractForServiceAction(cardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const card = await getServiceCardForOrganization(supabase, cardId, organization.id);
  if (card.contract_id) return { ok: true, contractId: card.contract_id };
  if (!card.client_id) throw new Error("Cadastre ou vincule um cliente antes de criar o contrato.");

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      organization_id: organization.id,
      client_id: card.client_id,
      proposal_id: card.proposal_id,
      service_card_id: card.id,
      title: `Contrato - ${card.title}`,
      description: card.description,
      status: "contrato_a_gerar",
      payment_status: card.payment_status ?? "pagamento_nao_efetuado",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("service_cards").update({ contract_id: data.id }).eq("id", card.id);
  if (card.proposal_id) {
    await supabase
      .from("proposals")
      .update({ contract_id: data.id })
      .eq("id", card.proposal_id);
  }
  await recordServiceEvent(supabase, {
    organizationId: organization.id,
    serviceCardId: card.id,
    userId: user.id,
    eventType: "service.contract_created",
    title: "Contrato criado",
    metadata: { contract_id: data.id },
  });
  revalidatePath("/contratos");
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${card.id}`);
  return { ok: true, contractId: data.id };
}

export async function addServiceMemberAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const serviceCardId = formData.get("service_card_id")?.toString() ?? "";
  const userId = formData.get("user_id")?.toString() ?? "";
  const role = formData.get("role")?.toString() || "responsavel";
  if (!serviceCardId || !userId) throw new Error("Selecione um membro.");

  const { error } = await supabase.from("service_members").upsert(
    {
      organization_id: organization.id,
      service_card_id: serviceCardId,
      user_id: userId,
      role,
    },
    { onConflict: "service_card_id,user_id" },
  );
  if (error) throw new Error(error.message);

  await recordServiceEvent(supabase, {
    organizationId: organization.id,
    serviceCardId,
    userId: user.id,
    eventType: "service.member_added",
    title: "Membro adicionado",
    metadata: { user_id: userId, role },
  });
  revalidatePath(`/servicos/${serviceCardId}`);
}

export async function createChecklistAction(formData: FormData) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const parsed = checklistSchema.parse(formDataToObject(formData));

  const { error } = await supabase.from("checklists").insert(parsed);
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "checklist.created",
    entityType: "service_card",
    entityId: parsed.service_card_id,
  });

  revalidatePath(`/servicos/${parsed.service_card_id}`);
}

export async function createChecklistItemAction(formData: FormData) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const parsed = checklistItemSchema.parse(formDataToObject(formData));

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("service_card_id")
    .eq("id", parsed.checklist_id)
    .single();
  if (checklistError) throw new Error(checklistError.message);

  const { error } = await supabase.from("checklist_items").insert(parsed);
  if (error) throw new Error(error.message);

  await refreshChecklistPercent(supabase, checklist.service_card_id);
  revalidatePath(`/servicos/${checklist.service_card_id}`);
  revalidatePath("/servicos");
}

export async function toggleChecklistItemAction(
  itemId: string,
  checklistId: string,
  isDone: boolean,
) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("service_card_id")
    .eq("id", checklistId)
    .single();
  if (checklistError) throw new Error(checklistError.message);

  const { error } = await supabase
    .from("checklist_items")
    .update({ is_done: isDone })
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await refreshChecklistPercent(supabase, checklist.service_card_id);
  revalidatePath(`/servicos/${checklist.service_card_id}`);
  revalidatePath("/servicos");
}

async function refreshChecklistPercent(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  serviceCardId: string,
) {
  const { data: checklistsData } = await supabase
    .from("checklists")
    .select("id")
    .eq("service_card_id", serviceCardId);
  const checklists = checklistsData ?? [];

  const ids = checklists.map((item) => item.id);
  if (!ids.length) {
    await supabase
      .from("service_cards")
      .update({ checklist_percent: 0 })
      .eq("id", serviceCardId);
    return;
  }

  const { data: itemsData } = await supabase
    .from("checklist_items")
    .select("is_done")
    .in("checklist_id", ids);
  const items = itemsData ?? [];

  const total = items.length;
  const done = items.filter((item) => item.is_done).length;
  const percent = total ? Number(((done / total) * 100).toFixed(2)) : 0;

  await supabase
    .from("service_cards")
    .update({ checklist_percent: percent })
    .eq("id", serviceCardId);
}

async function createDefaultChecklistForService(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  serviceCardId: string,
  serviceType: ProposalServiceType,
) {
  const { data: existing } = await supabase
    .from("checklists")
    .select("id")
    .eq("service_card_id", serviceCardId)
    .limit(1);
  if (existing?.length) return;

  const { data: checklist, error } = await supabase
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
    const { error: itemsError } = await supabase.from("checklist_items").insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }
}

async function getServiceColumnContext(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  cardId: string,
): Promise<{ card: ServiceCard; currentColumn: ServiceColumn; columns: ServiceColumn[] }> {
  const { data: card, error: cardError } = await supabase
    .from("service_cards")
    .select("*")
    .eq("id", cardId)
    .single();
  if (cardError) throw new Error(cardError.message);

  const { data: currentColumn, error: columnError } = await supabase
    .from("service_columns")
    .select("*")
    .eq("id", card.column_id)
    .single();
  if (columnError) throw new Error(columnError.message);

  const { data: columns, error: columnsError } = await supabase
    .from("service_columns")
    .select("*")
    .eq("board_id", currentColumn.board_id)
    .order("position");
  if (columnsError) throw new Error(columnsError.message);

  return { card, currentColumn, columns: columns ?? [] };
}

async function resolveInitialColumnForServiceType(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  serviceType: ProposalServiceType,
  fallbackColumnId: string,
) {
  const boardSlug = serviceTypeToBoardSlug[serviceType];
  const { data: board, error: boardError } = await supabase
    .from("service_boards")
    .select("id")
    .eq("slug", boardSlug)
    .maybeSingle();
  if (boardError) throw new Error(boardError.message);

  if (!board?.id) return fallbackColumnId;

  const { data: columns, error: columnsError } = await supabase
    .from("service_columns")
    .select("*")
    .eq("board_id", board.id)
    .order("position");
  if (columnsError) throw new Error(columnsError.message);

  return getInitialServiceColumn(columns ?? [])?.id ?? fallbackColumnId;
}

async function moveCardToColumn(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    cardId,
    fromColumnId,
    toColumnId,
    userId,
    organizationId,
    eventTitle,
  }: {
    cardId: string;
    fromColumnId: string | null;
    toColumnId: string;
    userId: string;
    organizationId: string | null;
    eventTitle: string;
  },
) {
  const { error } = await supabase
    .from("service_cards")
    .update({ column_id: toColumnId })
    .eq("id", cardId);
  if (error) throw new Error(error.message);

  await supabase.from("service_card_movements").insert({
    service_card_id: cardId,
    from_column_id: fromColumnId,
    to_column_id: toColumnId,
    moved_by: userId,
  });

  await recordServiceEvent(supabase, {
    organizationId,
    serviceCardId: cardId,
    userId,
    eventType: "service.stage_changed",
    title: eventTitle,
    metadata: { from_column_id: fromColumnId, to_column_id: toColumnId },
  });

  await logAudit(supabase, {
    action: "service_card.moved",
    entityType: "service_card",
    entityId: cardId,
    metadata: { from_column_id: fromColumnId, to_column_id: toColumnId },
  });

  const columnIds = [fromColumnId, toColumnId].filter(Boolean) as string[];
  const { data: movementColumns } = columnIds.length
    ? await supabase.from("service_columns").select("id,slug,name").in("id", columnIds)
    : { data: [] };
  const fromColumn = movementColumns?.find((column) => column.id === fromColumnId) ?? null;
  const toColumn = movementColumns?.find((column) => column.id === toColumnId) ?? null;
  const wasLost = isServiceLostColumn(fromColumn);
  const isLost = isServiceLostColumn(toColumn);

  if (!wasLost && isLost) {
    await recordServiceEvent(supabase, {
      organizationId,
      serviceCardId: cardId,
      userId,
      eventType: "service.lost",
      title: "Servico marcado como perdido",
      metadata: { from_column_id: fromColumnId, to_column_id: toColumnId },
    });
  }

  if (wasLost && !isLost) {
    await recordServiceEvent(supabase, {
      organizationId,
      serviceCardId: cardId,
      userId,
      eventType: "service.reactivated",
      title: "Servico reativado",
      metadata: { from_column_id: fromColumnId, to_column_id: toColumnId },
    });
  }

  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: cardId,
    userId,
  });
}

async function syncAutomaticServiceRevenueForCard(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    serviceCardId,
    userId,
  }: {
    serviceCardId: string;
    userId: string;
  },
) {
  const { data: card, error: cardError } = await supabase
    .from("service_cards")
    .select("id,organization_id,client_id,proposal_id,contract_id,title,due_date,payment_status,custom_fields_json,column_id")
    .eq("id", serviceCardId)
    .single();
  if (cardError) throw new Error(cardError.message);

  const value = getServiceEstimatedValue(card as ServiceCard);
  const { data: column } = await supabase
    .from("service_columns")
    .select("slug,name")
    .eq("id", card.column_id)
    .maybeSingle();
  const isLost = isServiceLostColumn(column);
  const shouldBePaid = isPaidService(card.payment_status) && !isLost;

  if (process.env.NODE_ENV !== "production") {
    console.info("[servicos:finance-sync]", {
      userId,
      organizationId: card.organization_id,
      serviceCardId: card.id,
      serviceValue: value,
      paymentStatus: card.payment_status,
      isLost,
      hasClient: Boolean(card.client_id),
    });
  }

  if (value <= 0 || !card.client_id) return;

  const revenuePayload = {
    organization_id: card.organization_id,
    client_id: card.client_id,
    proposal_id: card.proposal_id,
    service_card_id: card.id,
    contract_id: card.contract_id,
    auto_generated: true,
    description: `Receita do servico - ${card.title}`,
    category: "Servico automatico",
    amount: value,
    due_date: card.due_date ?? new Date().toISOString().slice(0, 10),
    paid_at: shouldBePaid ? new Date().toISOString().slice(0, 10) : null,
    status: shouldBePaid ? "paid" : "pending",
  } as const;

  const { data: existing, error: existingError } = await supabase
    .from("revenues")
    .select("id")
    .eq("service_card_id", card.id)
    .eq("auto_generated", true)
    .limit(1);
  if (existingError) throw new Error(existingError.message);

  const existingId = existing?.[0]?.id;
  if (existingId) {
    const { error } = await supabase
      .from("revenues")
      .update(revenuePayload)
      .eq("id", existingId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("revenues").insert(revenuePayload);
  if (error) throw new Error(error.message);
}

async function getServiceCardForOrganization(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  cardId: string,
  organizationId: string,
) {
  const { data: card, error } = await supabase
    .from("service_cards")
    .select("*")
    .eq("id", cardId)
    .eq("organization_id", organizationId)
    .single();
  if (error) throw new Error(error.message);
  return card;
}

async function recordServiceEvent(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    organizationId,
    serviceCardId,
    userId,
    eventType,
    title,
    description = null,
    metadata = {},
  }: {
    organizationId: string | null;
    serviceCardId: string;
    userId: string | null;
    eventType: string;
    title: string;
    description?: string | null;
    metadata?: Json;
  },
) {
  const { error } = await supabase.from("service_events").insert({
    organization_id: organizationId,
    service_card_id: serviceCardId,
    event_type: eventType,
    title,
    description,
    metadata,
    created_by: userId,
  });

  if (error && !isMissingRelation(error.message)) {
    throw new Error(error.message);
  }
}

function isMissingRelation(message: string) {
  return /relation .*service_events/i.test(message) || /Could not find .*service_events/i.test(message);
}
