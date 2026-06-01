"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import {
  clientSchema,
  checklistItemSchema,
  checklistSchema,
  serviceEditSchema,
  servicePropertyInfoSchema,
  serviceReceiptSchema,
  serviceCardSchema,
} from "@/lib/schemas";
import { canManageOrganization, getCurrentOrganizationContext, getCurrentOrganizationForUser } from "@/lib/organization";
import { generateReminderNotifications, NOTIFICATION_ON_CONFLICT } from "@/lib/notifications/reminders";
import {
  getExecutionColumn,
  getNextColumn,
  getProposalContractColumn,
  getInitialServiceColumn,
} from "@/lib/services/service-flow";
import {
  isConcludedServiceColumn,
  isOverdueServiceColumn,
} from "@/lib/services/service-period";
import {
  getServiceEstimatedValue,
  isPaidService,
  isServiceLostColumn,
} from "@/lib/services/service-finance";
import { serviceTypeToBoardSlug } from "@/lib/services/service-cards";
import { createServerSupabase } from "@/lib/supabase/server";
import { revertServiceToProposal as revertServiceToProposalAction } from "@/app/(app)/propostas/actions";
import type { Json, OrganizationMember, PaymentStatus, Priority, ProposalServiceType, ServiceCard, ServiceColumn } from "@/types/database";

type InitialServiceStepInput = {
  title: string;
  created_at: string | null;
  due_date: string | null;
  due_time: string | null;
};

export async function revertServiceToProposal(cardId: string) {
  return revertServiceToProposalAction(cardId);
}

export async function createServiceCardAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = serviceCardSchema.parse(formDataToObject(formData));
  const initialSteps = parseInitialServiceSteps(formData.get("initial_steps_json"));
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
  await ensureEmptyServiceChecklists(
    supabase,
    data.id,
    organization.id,
  );
  if (initialSteps.length) {
    const stepsChecklistId = await ensureServiceChecklistByType(
      supabase,
      organization.id,
      data.id,
      "steps",
    );
    for (const step of initialSteps) {
      await createServiceChecklistItemRecord(supabase, {
        organizationId: organization.id,
        actorUserId: user.id,
        checklistId: stepsChecklistId,
        checklistType: "steps",
        serviceCardId: data.id,
        serviceTitle: parsed.title,
        responsibleUserId: parsed.responsible_user_id,
        title: step.title,
        isDone: false,
        createdDate: step.created_at,
        dueDate: step.due_date,
        dueTime: step.due_time,
      });
    }
    await refreshChecklistPercent(supabase, data.id);
  }
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

export async function deleteServiceCardAction(cardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const card = await getServiceCardForOrganization(supabase, cardId, organization.id);

  if (process.env.NODE_ENV !== "production") {
    console.info("[servicos:delete]", {
      userId: user.id,
      organizationId: organization.id,
      serviceCardId: card.id,
      serviceValue: getServiceEstimatedValue(card),
    });
  }

  const proposalIds = [
    card.proposal_id,
    card.created_from_proposal_id,
  ].filter(Boolean) as string[];
  const contractIds = [card.contract_id].filter(Boolean) as string[];

  await deleteByServiceCard(supabase, "revenues", organization.id, card.id, {
    autoGeneratedOnly: true,
  });
  await clearExpensesServiceLink(supabase, organization.id, card.id);

  if (contractIds.length) {
    await supabase
      .from("contracts")
      .delete()
      .eq("organization_id", organization.id)
      .in("id", contractIds);
  }
  await supabase
    .from("contracts")
    .delete()
    .eq("organization_id", organization.id)
    .eq("service_card_id", card.id);

  if (proposalIds.length) {
    await supabase
      .from("proposals")
      .delete()
      .eq("organization_id", organization.id)
      .in("id", proposalIds);
  }
  await supabase
    .from("proposals")
    .delete()
    .eq("organization_id", organization.id)
    .eq("service_card_id", card.id);
  await supabase
    .from("proposals")
    .delete()
    .eq("organization_id", organization.id)
    .eq("converted_service_card_id", card.id);

  const { data: checklists } = await supabase
    .from("checklists")
    .select("id")
    .eq("service_card_id", card.id);
  const checklistIds = (checklists ?? []).map((item) => item.id);
  if (checklistIds.length) {
    await supabase.from("checklist_items").delete().in("checklist_id", checklistIds);
  }
  await supabase.from("checklists").delete().eq("service_card_id", card.id);
  await supabase
    .from("service_members")
    .delete()
    .eq("organization_id", organization.id)
    .eq("service_card_id", card.id);
  await supabase
    .from("service_card_movements")
    .delete()
    .eq("service_card_id", card.id);
  await supabase
    .from("service_events")
    .delete()
    .eq("organization_id", organization.id)
    .eq("service_card_id", card.id);

  const { error } = await supabase
    .from("service_cards")
    .delete()
    .eq("id", card.id)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "service_card.deleted",
    entityType: "service_card",
    entityId: card.id,
    metadata: {
      proposal_ids: proposalIds,
      contract_ids: contractIds,
      client_id: card.client_id,
    },
  });

  revalidatePath("/servicos");
  revalidatePath("/financeiro");
  revalidatePath("/");
  revalidatePath("/propostas");
  revalidatePath("/contratos");
  return { ok: true };
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
  const target =
    getProposalContractColumn(context.columns) ??
    getNextColumn(context.columns, context.card.column_id);
  if (!target || target.id === context.card.column_id) {
    throw new Error("Proxima coluna do servico nao encontrada.");
  }

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

export async function updateServiceDetailsAction(cardId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) throw new Error("Usuario sem organizacao.");
  const card = await getServiceCardForOrganization(supabase, cardId, context.organization.id);
  assertCanEditService(context.membership, user.id, card);

  const parsed = serviceEditSchema.parse(formDataToObject(formData));
  const nextClientId = formData.has("client_id") ? parsed.client_id : card.client_id;
  if (nextClientId) {
    const { data: selectedClient, error: selectedClientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", nextClientId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();
    if (selectedClientError) throw new Error(selectedClientError.message);
    if (!selectedClient) throw new Error("Cliente selecionado nao pertence a organizacao atual.");
  }
  const metadata = asRecord(card.custom_fields_json);
  const nextMetadata = {
    ...metadata,
    valor_previsto: parsed.estimated_value,
  };

  const { error } = await supabase
    .from("service_cards")
    .update({
      client_id: nextClientId,
      title: parsed.title,
      description: parsed.description,
      municipality: parsed.municipality,
      responsible_user_id: parsed.responsible_user_id,
      service_type: parsed.service_type,
      custom_service_name: parsed.custom_service_name,
      service_date: parsed.service_date,
      due_date: parsed.due_date,
      payment_condition: parsed.payment_condition,
      custom_fields_json: nextMetadata,
    })
    .eq("id", card.id)
    .eq("organization_id", context.organization.id);
  if (error) throw new Error(error.message);

  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: card.id,
    userId: user.id,
  });
  await recordServiceEvent(supabase, {
    organizationId: context.organization.id,
    serviceCardId: card.id,
    userId: user.id,
    eventType: "service.updated",
    title: "Servico editado",
  });
  if (parsed.responsible_user_id && parsed.responsible_user_id !== card.responsible_user_id) {
    await supabase.from("notifications").upsert(
      {
        organization_id: context.organization.id,
        recipient_user_id: parsed.responsible_user_id,
        actor_user_id: user.id,
        type: "service_responsible_defined",
        title: "Responsavel por servico",
        message: `Voce foi definido como responsavel pelo servico ${parsed.title}.`,
        entity_type: "service_card",
        entity_id: card.id,
        action_url: `/servicos/${card.id}`,
        metadata: { category: "Projetos", service_card_id: card.id },
        scheduled_for: new Date().toISOString(),
        dedupe_key: `service-responsible:${context.organization.id}:${card.id}:${parsed.responsible_user_id}`,
      },
      { onConflict: NOTIFICATION_ON_CONFLICT },
    );
  }

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${card.id}`);
  revalidatePath("/financeiro");
  if (card.client_id) revalidatePath(`/clientes/${card.client_id}`);
  if (nextClientId) revalidatePath(`/clientes/${nextClientId}`);
}

export async function addServiceReceiptAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) throw new Error("Usuario sem organizacao.");
  const parsed = serviceReceiptSchema.parse(formDataToObject(formData));
  const card = await getServiceCardForOrganization(supabase, parsed.service_card_id, context.organization.id);
  assertCanEditService(context.membership, user.id, card);
  if (!card.client_id) throw new Error("Vincule um cliente antes de lancar recebimento.");

  const { data: revenue, error } = await supabase
    .from("revenues")
    .insert({
      organization_id: context.organization.id,
      client_id: card.client_id,
      proposal_id: card.proposal_id,
      contract_id: card.contract_id,
      service_card_id: card.id,
      auto_generated: false,
      description: parsed.description ?? `Recebimento - ${card.title}`,
      category: "Recebimento de servico",
      amount: parsed.amount,
      due_date: parsed.paid_at,
      paid_at: parsed.paid_at,
      status: "paid",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordServiceEvent(supabase, {
    organizationId: context.organization.id,
    serviceCardId: card.id,
    userId: user.id,
    eventType: "service.receipt_added",
    title: "Recebimento adicionado",
    metadata: { revenue_id: revenue.id, amount: parsed.amount },
  });
  revalidatePath(`/servicos/${card.id}`);
  revalidatePath("/financeiro");
  if (card.client_id) revalidatePath(`/clientes/${card.client_id}`);
}

export async function deleteServiceReceiptAction(revenueId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) throw new Error("Usuario sem organizacao.");
  const { data: revenue, error: revenueError } = await supabase
    .from("revenues")
    .select("*")
    .eq("id", revenueId)
    .eq("organization_id", context.organization.id)
    .single();
  if (revenueError) throw new Error(revenueError.message);
  if (!revenue.service_card_id) throw new Error("Recebimento sem servico vinculado.");
  const card = await getServiceCardForOrganization(supabase, revenue.service_card_id, context.organization.id);
  assertCanEditService(context.membership, user.id, card);

  const { error } = await supabase
    .from("revenues")
    .delete()
    .eq("id", revenue.id)
    .eq("organization_id", context.organization.id);
  if (error) throw new Error(error.message);

  await recordServiceEvent(supabase, {
    organizationId: context.organization.id,
    serviceCardId: card.id,
    userId: user.id,
    eventType: "service.receipt_deleted",
    title: "Recebimento removido",
    metadata: { revenue_id: revenue.id, amount: revenue.amount },
  });
  revalidatePath(`/servicos/${card.id}`);
  revalidatePath("/financeiro");
  if (card.client_id) revalidatePath(`/clientes/${card.client_id}`);
}

export async function addServicePropertyInfoAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = servicePropertyInfoSchema.parse(formDataToObject(formData));
  await getServiceCardForOrganization(supabase, parsed.service_card_id, organization.id);
  const { error } = await supabase.from("service_property_infos").insert({
    organization_id: organization.id,
    service_card_id: parsed.service_card_id,
    title: parsed.title,
    value: parsed.value,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/servicos/${parsed.service_card_id}`);
}

export async function deleteServicePropertyInfoAction(infoId: string, serviceCardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { error } = await supabase
    .from("service_property_infos")
    .delete()
    .eq("id", infoId)
    .eq("service_card_id", serviceCardId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/servicos/${serviceCardId}`);
}

export async function createClientForServiceAction(cardId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) throw new Error("Usuario sem organizacao.");
  const card = await getServiceCardForOrganization(supabase, cardId, context.organization.id);
  assertCanEditService(context.membership, user.id, card);
  const parsed = clientSchema.parse(formDataToObject(formData));

  const { data: client, error } = await supabase
    .from("clients")
    .insert({ ...parsed, organization_id: context.organization.id, created_by: user.id })
    .select("id,name")
    .single();
  if (error) throw new Error(error.message);

  const { error: cardError } = await supabase
    .from("service_cards")
    .update({ client_id: client.id })
    .eq("id", cardId)
    .eq("organization_id", context.organization.id);
  if (cardError) throw new Error(cardError.message);
  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: cardId,
    userId: user.id,
  });

  await recordServiceEvent(supabase, {
    organizationId: context.organization.id,
    serviceCardId: cardId,
    userId: user.id,
    eventType: "service.client_created",
    title: "Cliente cadastrado e vinculado",
    metadata: { client_id: client.id, client_name: client.name },
  });

  revalidatePath("/clientes");
  revalidatePath("/minha-empresa");
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
  revalidatePath("/financeiro");
  return { ok: true, clientId: client.id };
}

export async function linkExistingClientToServiceAction(cardId: string, clientId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) throw new Error("Usuario sem organizacao.");
  const card = await getServiceCardForOrganization(supabase, cardId, context.organization.id);
  assertCanEditService(context.membership, user.id, card);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id,name")
    .eq("id", clientId)
    .eq("organization_id", context.organization.id)
    .single();
  if (clientError) throw new Error(clientError.message);

  const { error } = await supabase
    .from("service_cards")
    .update({ client_id: client.id })
    .eq("id", card.id)
    .eq("organization_id", context.organization.id);
  if (error) throw new Error(error.message);

  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: card.id,
    userId: user.id,
  });
  await recordServiceEvent(supabase, {
    organizationId: context.organization.id,
    serviceCardId: card.id,
    userId: user.id,
    eventType: "service.client_linked",
    title: `Cliente ${client.name} vinculado ao servico.`,
    metadata: { client_id: client.id, client_name: client.name },
  });

  revalidatePath("/clientes");
  if (card.client_id) revalidatePath(`/clientes/${card.client_id}`);
  revalidatePath(`/clientes/${client.id}`);
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${card.id}`);
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
  const { data: service } = await supabase
    .from("service_cards")
    .select("title")
    .eq("id", serviceCardId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  await supabase.from("notifications").upsert(
    {
      organization_id: organization.id,
      recipient_user_id: userId,
      actor_user_id: user.id,
      type: "service_member_added",
      title: "Voce foi adicionado a um servico",
      message: `Voce foi adicionado ao servico ${service?.title ?? "servico"}.`,
      entity_type: "service_card",
      entity_id: serviceCardId,
      action_url: `/servicos/${serviceCardId}`,
      metadata: { category: "Projetos", service_card_id: serviceCardId },
      scheduled_for: new Date().toISOString(),
      dedupe_key: `service-member-added:${organization.id}:${serviceCardId}:${userId}`,
    },
    { onConflict: NOTIFICATION_ON_CONFLICT },
  );
  revalidatePath(`/servicos/${serviceCardId}`);
}

export async function createServiceInteractionAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const serviceCardId = formData.get("service_card_id")?.toString() ?? "";
  const title = formData.get("title")?.toString().trim() || "Interacao registrada";
  const description = formData.get("description")?.toString().trim() ?? "";
  const reminderDate = formData.get("reminder_date")?.toString() || null;
  const reminderTime = formData.get("reminder_time")?.toString() || null;
  if (!serviceCardId) throw new Error("Servico invalido.");
  if (!description) throw new Error("Descreva a interacao.");

  const card = await getServiceCardForOrganization(supabase, serviceCardId, organization.id);
  await recordServiceEvent(supabase, {
    organizationId: organization.id,
    serviceCardId,
    userId: user.id,
    eventType: "service.interaction",
    title,
    description,
    metadata: {
      reminder_date: reminderDate,
      reminder_time: reminderTime,
      kind: reminderDate ? "lembrete" : "interacao",
    },
  });
  if (reminderDate) {
    await createAgendaReminderForEntity(supabase, {
      organizationId: organization.id,
      entityType: "service_card",
      entityId: serviceCardId,
      title,
      description: `Servico ${card.title}: ${description || title}`,
      reminderDate,
      reminderTime,
      createdBy: user.id,
      recipientUserIds: [card.responsible_user_id, user.id].filter(Boolean) as string[],
    });
  }

  revalidatePath(`/servicos/${serviceCardId}`);
  revalidatePath("/servicos");
  return { ok: true };
}

export async function createChecklistAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = checklistSchema.parse(formDataToObject(formData));

  const { error } = await supabase.from("checklists").insert({
    ...parsed,
    organization_id: organization.id,
  });
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
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = checklistItemSchema.parse(formDataToObject(formData));
  const checklistId = parsed.checklist_id ?? await ensureServiceChecklistByType(
    supabase,
    organization.id,
    parsed.service_card_id,
    parsed.checklist_type,
  );

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("service_card_id,checklist_type,organization_id")
    .eq("id", checklistId)
    .eq("organization_id", organization.id)
    .single();
  if (checklistError) throw new Error(checklistError.message);
  const checklistOrganizationId = checklist.organization_id ?? organization.id;

  const { data: card } =
    checklist.checklist_type === "steps"
      ? await supabase
      .from("service_cards")
      .select("title,responsible_user_id")
      .eq("id", checklist.service_card_id)
      .eq("organization_id", checklistOrganizationId)
      .maybeSingle()
      : { data: null };

  await createServiceChecklistItemRecord(supabase, {
    organizationId: checklistOrganizationId,
    actorUserId: user.id,
    checklistId,
    checklistType: checklist.checklist_type,
    serviceCardId: checklist.service_card_id,
    serviceTitle: card?.title ?? "servico",
    responsibleUserId: card?.responsible_user_id ?? null,
    title: parsed.title,
    isDone: parsed.is_done,
    createdDate: parsed.created_at,
    dueDate: parsed.due_date,
    dueTime: parsed.due_time,
  });

  await refreshChecklistPercent(supabase, checklist.service_card_id);
  revalidatePath(`/servicos/${checklist.service_card_id}`);
  revalidatePath("/servicos");
}

export async function updateChecklistItemAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = checklistItemSchema.parse(formDataToObject(formData));
  const itemId = formData.get("item_id")?.toString() ?? "";
  if (!itemId || !parsed.checklist_id) throw new Error("Item de checklist invalido.");

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("service_card_id,checklist_type,organization_id")
    .eq("id", parsed.checklist_id)
    .eq("organization_id", organization.id)
    .single();
  if (checklistError) throw new Error(checklistError.message);

  const scheduledAt =
    parsed.due_date && parsed.due_time
      ? new Date(`${parsed.due_date}T${parsed.due_time}:00-03:00`).toISOString()
      : null;
  const { error } = await supabase
    .from("checklist_items")
    .update({
      title: parsed.title,
      due_date: parsed.due_date,
      due_time: parsed.due_time,
      scheduled_at: scheduledAt,
    })
    .eq("id", itemId)
    .eq("checklist_id", parsed.checklist_id);
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
  const user = await requireUser(supabase);

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("service_card_id,checklist_type,organization_id")
    .eq("id", checklistId)
    .single();
  if (checklistError) throw new Error(checklistError.message);

  const { error } = await supabase
    .from("checklist_items")
    .update({
      is_done: isDone,
      completed_at: isDone ? new Date().toISOString() : null,
      completed_by: isDone ? user.id : null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await refreshChecklistPercent(supabase, checklist.service_card_id);
  if (isDone && checklist.checklist_type === "steps" && checklist.organization_id) {
    const { data: item } = await supabase
      .from("checklist_items")
      .select("title")
      .eq("id", itemId)
      .maybeSingle();
    await markServiceStepRemindersCompleted(supabase, {
      organizationId: checklist.organization_id,
      serviceCardId: checklist.service_card_id,
      itemTitle: item?.title ?? "Etapa",
    });
    await recordServiceEvent(supabase, {
      organizationId: checklist.organization_id,
      serviceCardId: checklist.service_card_id,
      userId: user.id,
      eventType: "service.step_completed",
      title: "Etapa concluida",
      description: item?.title ?? "Etapa",
      metadata: { checklist_item_id: itemId },
    });
    await notifyOwnersAboutServiceStepCompletion(supabase, {
      organizationId: checklist.organization_id,
      actorUserId: user.id,
      serviceCardId: checklist.service_card_id,
      itemTitle: item?.title ?? "Etapa",
    });
  }
  revalidatePath(`/servicos/${checklist.service_card_id}`);
  revalidatePath("/servicos");
}

export async function deleteChecklistItemAction(itemId: string, checklistId: string) {
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
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("checklist_id", checklistId);
  if (error) throw new Error(error.message);
  await refreshChecklistPercent(supabase, checklist.service_card_id);
  revalidatePath(`/servicos/${checklist.service_card_id}`);
  revalidatePath("/servicos");
}

export async function deleteServiceEventAction(eventId: string, serviceCardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { error } = await supabase
    .from("service_events")
    .delete()
    .eq("id", eventId)
    .eq("service_card_id", serviceCardId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/servicos/${serviceCardId}`);
}

export async function deleteServiceMovementAction(movementId: string, serviceCardId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await getServiceCardForOrganization(supabase, serviceCardId, organization.id);
  const { error } = await supabase
    .from("service_card_movements")
    .delete()
    .eq("id", movementId)
    .eq("service_card_id", serviceCardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/servicos/${serviceCardId}`);
}

async function createServiceChecklistItemRecord(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    organizationId,
    actorUserId,
    checklistId,
    checklistType,
    serviceCardId,
    serviceTitle,
    responsibleUserId,
    title,
    isDone,
    createdDate,
    dueDate,
    dueTime,
  }: {
    organizationId: string;
    actorUserId: string;
    checklistId: string;
    checklistType: "documents" | "steps";
    serviceCardId: string;
    serviceTitle: string;
    responsibleUserId: string | null | undefined;
    title: string;
    isDone: boolean;
    createdDate: string | null;
    dueDate: string | null;
    dueTime: string | null;
  },
) {
  const scheduledAt =
    dueDate && dueTime
      ? new Date(`${dueDate}T${dueTime}:00-03:00`).toISOString()
      : null;
  const { data: item, error } = await supabase
    .from("checklist_items")
    .insert({
      checklist_id: checklistId,
      title,
      is_done: isDone,
      due_date: dueDate,
      due_time: dueTime,
      created_at: createdDate ? `${createdDate}T00:00:00-03:00` : undefined,
      scheduled_at: scheduledAt,
    })
    .select("id,title,due_date,due_time")
    .single();
  if (error) throw new Error(error.message);

  if (item?.due_date && checklistType === "steps") {
    const { data: owners } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .eq("role", "owner");
    const recipients = [
      actorUserId,
      responsibleUserId,
      ...((owners ?? []).map((owner) => owner.user_id) ?? []),
    ].filter(Boolean) as string[];
    await createAgendaReminderForEntity(supabase, {
      organizationId,
      entityType: "service_card",
      entityId: serviceCardId,
      title: `Etapa: ${item.title}`,
      description: `Servico ${serviceTitle}: ${item.title}`,
      reminderDate: item.due_date,
      reminderTime: item.due_time,
      createdBy: actorUserId,
      recipientUserIds: recipients,
      category: "Servicos",
    });
    await createDailyTaskForServiceStep(supabase, {
      organizationId,
      userId: responsibleUserId ?? actorUserId,
      createdBy: actorUserId,
      serviceCardId,
      serviceTitle,
      itemTitle: item.title,
      dueDate: item.due_date,
    });
  }

  if (isDone && checklistType === "steps") {
    await notifyOwnersAboutServiceStepCompletion(supabase, {
      organizationId,
      actorUserId,
      serviceCardId,
      itemTitle: title,
    });
  }
}

async function refreshChecklistPercent(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  serviceCardId: string,
) {
  const { data: checklistsData } = await supabase
    .from("checklists")
    .select("id")
    .eq("service_card_id", serviceCardId)
    .eq("checklist_type", "steps");
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
    .in("checklist_id", ids)
    .is("deleted_at", null)
    .is("archived_at", null);
  const items = itemsData ?? [];

  const total = items.length;
  const done = items.filter((item) => item.is_done).length;
  const percent = total ? Number(((done / total) * 100).toFixed(2)) : 0;

  await supabase
    .from("service_cards")
    .update({ checklist_percent: percent })
    .eq("id", serviceCardId);
}

async function ensureServiceChecklistByType(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  serviceCardId: string | null | undefined,
  checklistType: "documents" | "steps" | undefined,
) {
  if (!serviceCardId || !checklistType) throw new Error("Servico ou tipo de checklist invalido.");
  const { data: existing, error: existingError } = await supabase
    .from("checklists")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("service_card_id", serviceCardId)
    .eq("checklist_type", checklistType)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("checklists")
    .insert({
      organization_id: organizationId,
      service_card_id: serviceCardId,
      title: checklistType === "steps" ? "Checklist - Etapas" : "Checklist - Documentos",
      checklist_type: checklistType,
      position: checklistType === "steps" ? 2 : 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

async function createDailyTaskForServiceStep(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    organizationId,
    userId,
    createdBy,
    serviceCardId,
    serviceTitle,
    itemTitle,
    dueDate,
  }: {
    organizationId: string;
    userId: string;
    createdBy: string;
    serviceCardId: string;
    serviceTitle: string;
    itemTitle: string;
    dueDate: string;
  },
) {
  const { data: checklist, error: checklistError } = await supabase
    .from("daily_checklists")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        checklist_date: dueDate,
      },
      { onConflict: "organization_id,user_id,checklist_date" },
    )
    .select("id")
    .single();
  if (checklistError) throw new Error(checklistError.message);

  const title = `Etapa: ${itemTitle} - ${serviceTitle}`;
  const { data: existing } = await supabase
    .from("daily_checklist_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("assigned_to", userId)
    .eq("related_service_id", serviceCardId)
    .eq("title", title)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { data: dailyItem, error: dailyError } = await supabase
    .from("daily_checklist_items")
    .insert({
      organization_id: organizationId,
      checklist_id: checklist.id,
      assigned_to: userId,
      created_by: createdBy,
      title,
      due_date: dueDate,
      related_service_id: serviceCardId,
      source: "self",
    })
    .select("id")
    .single();
  if (dailyError) throw new Error(dailyError.message);

  await supabase.from("routine_items").insert({
    organization_id: organizationId,
    user_id: userId,
    title,
    routine_scope: "daily",
    routine_date: dueDate,
    source: "service_step",
    daily_checklist_item_id: dailyItem.id,
    created_by: createdBy,
  });
}

async function markServiceStepRemindersCompleted(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    organizationId,
    serviceCardId,
    itemTitle,
  }: {
    organizationId: string;
    serviceCardId: string;
    itemTitle: string;
  },
) {
  const now = new Date().toISOString();
  await supabase
    .from("agenda_reminders")
    .update({ completed_at: now, canceled_at: now })
    .eq("organization_id", organizationId)
    .eq("entity_type", "service_card")
    .eq("entity_id", serviceCardId)
    .ilike("title", `%${itemTitle}%`)
    .is("completed_at", null);
}

async function ensureEmptyServiceChecklists(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  serviceCardId: string,
  organizationId: string,
) {
  const { data: existing } = await supabase
    .from("checklists")
    .select("id")
    .eq("service_card_id", serviceCardId)
    .limit(1);
  if (existing?.length) return;

  const { error } = await supabase.from("checklists").insert([
    {
      organization_id: organizationId,
      service_card_id: serviceCardId,
      title: "Checklist - Documentos",
      checklist_type: "documents",
      position: 1,
    },
    {
      organization_id: organizationId,
      service_card_id: serviceCardId,
      title: "Checklist - Etapas",
      checklist_type: "steps",
      position: 2,
    },
  ]);
  if (error) throw new Error(error.message);
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
  const { data: targetColumn } = await supabase
    .from("service_columns")
    .select("slug,name")
    .eq("id", toColumnId)
    .maybeSingle();
  const isFinished = isConcludedServiceColumn(targetColumn);

  const { error } = await supabase
    .from("service_cards")
    .update({
      column_id: toColumnId,
      completed_at: isFinished ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", cardId);
  if (error) throw new Error(error.message);

  await supabase.from("service_card_movements").insert({
    service_card_id: cardId,
    from_column_id: fromColumnId,
    to_column_id: toColumnId,
    moved_by: userId,
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
  const movementTitle = toColumn?.name
    ? fromColumn?.name
      ? `${eventTitle} de ${fromColumn.name} para ${toColumn.name}`
      : `${eventTitle} para ${toColumn.name}`
    : eventTitle;

  await recordServiceEvent(supabase, {
    organizationId,
    serviceCardId: cardId,
    userId,
    eventType: "service.stage_changed",
    title: movementTitle,
    metadata: {
      from_column_id: fromColumnId,
      from_column_name: fromColumn?.name ?? null,
      to_column_id: toColumnId,
      to_column_name: toColumn?.name ?? null,
    },
  });

  const wasLost = isServiceLostColumn(fromColumn);
  const isLost = isServiceLostColumn(toColumn);
  const wasOverdue = isOverdueServiceColumn(fromColumn);
  const isOverdue = isOverdueServiceColumn(toColumn);

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

  if (!wasOverdue && isOverdue) {
    await recordServiceEvent(supabase, {
      organizationId,
      serviceCardId: cardId,
      userId,
      eventType: "service.overdue",
      title: "Servico marcado como atrasado",
      metadata: { from_column_id: fromColumnId, to_column_id: toColumnId },
    });
  }

  if (wasOverdue && !isOverdue) {
    await recordServiceEvent(supabase, {
      organizationId,
      serviceCardId: cardId,
      userId,
      eventType: "service.overdue_resolved",
      title: "Servico saiu de atraso",
      metadata: { from_column_id: fromColumnId, to_column_id: toColumnId },
    });
  }

  await syncAutomaticServiceRevenueForCard(supabase, {
    serviceCardId: cardId,
    userId,
  });
}

async function deleteByServiceCard(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  table: "revenues",
  organizationId: string,
  serviceCardId: string,
  options: { autoGeneratedOnly: boolean },
) {
  let query = supabase
    .from(table)
    .delete()
    .eq("organization_id", organizationId)
    .eq("service_card_id", serviceCardId);
  if (options.autoGeneratedOnly) query = query.eq("auto_generated", true);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function clearExpensesServiceLink(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  serviceCardId: string,
) {
  const { error } = await supabase
    .from("expenses")
    .update({ service_card_id: null })
    .eq("organization_id", organizationId)
    .eq("service_card_id", serviceCardId);
  if (error) throw new Error(error.message);
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

function assertCanEditService(
  membership: Pick<OrganizationMember, "role" | "status"> | null,
  userId: string,
  card: Pick<ServiceCard, "responsible_user_id">,
) {
  if (canManageOrganization({ profile: null, membership })) return;
  if (card.responsible_user_id === userId) return;
  throw new Error("Apenas o proprietario da empresa ou o responsavel principal pode editar este servico.");
}

function asRecord(value: Json | undefined): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}

function parseInitialServiceSteps(value: FormDataEntryValue | null): InitialServiceStepInput[] {
  if (!value) return [];
  if (typeof value !== "string") throw new Error("Etapas iniciais invalidas.");
  const raw = value.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Etapas iniciais invalidas.");
  }

  if (!Array.isArray(parsed)) throw new Error("Etapas iniciais invalidas.");
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Etapa inicial ${index + 1} invalida.`);
    }
    const record = entry as Record<string, unknown>;
    const title = String(record.title ?? "").trim();
    if (title.length < 2) throw new Error(`Informe o nome da etapa ${index + 1}.`);

    return {
      title,
      created_at: normalizeDateField(record.created_at, todayBrazilDate()),
      due_date: normalizeDateField(record.due_date, null),
      due_time: normalizeTimeField(record.due_time),
    };
  });
}

function normalizeDateField(value: unknown, fallback: string | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("Data da etapa invalida.");
  return text;
}

function normalizeTimeField(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (!/^\d{2}:\d{2}$/.test(text)) throw new Error("Horario da etapa invalido.");
  const [hours, minutes] = text.split(":").map(Number);
  if (hours > 23 || minutes > 59) throw new Error("Horario da etapa invalido.");
  return text;
}

function todayBrazilDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function createAgendaReminderForEntity(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    organizationId,
    entityType,
    entityId,
    title,
    description,
    reminderDate,
    reminderTime,
    createdBy,
    recipientUserIds,
    category = "Servicos",
  }: {
    organizationId: string;
    entityType: string;
    entityId: string;
    title: string;
    description: string | null;
    reminderDate: string;
    reminderTime: string | null;
    createdBy: string;
    recipientUserIds: string[];
    category?: string;
  },
) {
  const recipients = Array.from(new Set(recipientUserIds.filter(Boolean)));
  const { data: reminder, error: reminderError } = await supabase
    .from("agenda_reminders")
    .insert({
      organization_id: organizationId,
      title,
      description,
      reminder_date: reminderDate,
      reminder_time: reminderTime,
      created_by: createdBy,
      entity_type: entityType,
      entity_id: entityId,
      category,
    })
    .select("id")
    .single();
  if (reminderError) throw new Error(reminderError.message);

  if (recipients.length) {
    const { error: recipientsError } = await supabase.from("agenda_reminder_recipients").insert(
      recipients.map((recipientId) => ({
        organization_id: organizationId,
        reminder_id: reminder.id,
        recipient_user_id: recipientId,
      })),
    );
    if (recipientsError) throw new Error(recipientsError.message);

    await generateReminderNotifications(supabase, {
      organizationId,
      reminderId: reminder.id,
      entityType,
      entityId,
      title,
      description,
      reminderDate,
      reminderTime,
      recipientUserIds: recipients,
      actorUserId: createdBy,
      actionUrl: entityType === "service_card" ? `/servicos/${entityId}` : `/agenda?month=${reminderDate.slice(0, 7)}`,
      metadata: { reminder_id: reminder.id },
    });
  }
}

async function notifyOwnersAboutServiceStepCompletion(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  {
    organizationId,
    serviceCardId,
    actorUserId,
    itemTitle,
  }: {
    organizationId: string;
    serviceCardId: string;
    actorUserId: string;
    itemTitle: string;
  },
) {
  const { data: owners, error: ownersError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("role", "owner")
    .neq("user_id", actorUserId);
  if (ownersError) throw new Error(ownersError.message);
  const ownerIds = owners?.map((owner) => owner.user_id).filter(Boolean) ?? [];
  if (!ownerIds.length) return;

  const [{ data: service }, { data: actor }] = await Promise.all([
    supabase.from("service_cards").select("title").eq("id", serviceCardId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", actorUserId).maybeSingle(),
  ]);
  const actorName = actor?.full_name || "Um membro";
  const serviceTitle = service?.title || "servico";
  const now = new Date().toISOString();

  const { error } = await supabase.from("notifications").upsert(
    ownerIds.map((ownerId) => ({
      organization_id: organizationId,
      recipient_user_id: ownerId,
      actor_user_id: actorUserId,
      type: "service_step_completed",
      title: "Etapa de servico concluida",
      message: `${actorName} concluiu a etapa ${itemTitle} do servico ${serviceTitle}.`,
      entity_type: "service_card",
      entity_id: serviceCardId,
      action_url: `/servicos/${serviceCardId}`,
      metadata: { service_card_id: serviceCardId, item_title: itemTitle },
      scheduled_for: now,
      dedupe_key: `service-step:${serviceCardId}:${itemTitle}:${actorUserId}:${now.slice(0, 16)}`,
    })),
    { onConflict: NOTIFICATION_ON_CONFLICT },
  );
  if (error) throw new Error(error.message);
}

function isMissingRelation(message: string) {
  return /relation .*service_events/i.test(message) || /Could not find .*service_events/i.test(message);
}
