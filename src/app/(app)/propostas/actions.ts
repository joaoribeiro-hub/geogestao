"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import {
  proposalModelDraftSchema,
  proposalPdfSchema,
  proposalSchema,
} from "@/lib/schemas";
import {
  buildContractCancelUpdate,
  buildContractExecutionUpdate,
  buildContractInsertFromProposal,
} from "@/lib/services/contracts";
import {
  buildPaidRevenueInsertFromProposal,
  buildPaidRevenueUpdate,
} from "@/lib/services/finance";
import {
  buildPaymentStatusUpdate,
  buildProposalExecutionUpdate,
  buildProposalRevertUpdate,
} from "@/lib/services/proposals";
import {
  buildServiceCardInsertFromProposal,
  buildServiceCardUpdateFromProposal,
  chooseFirstActiveServiceColumn,
  resolveBoardSlugForProposal,
} from "@/lib/services/service-cards";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  PaymentStatus,
  Proposal,
  ProposalStage,
  ServiceBoard,
  ServiceColumn,
} from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export async function createProposalAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const parsed = proposalSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      ...parsed,
      owner_id: user.id,
      stage: "todo",
      payment_status: "pagamento_nao_efetuado",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    action: "proposal.created",
    entityType: "proposal",
    entityId: data.id,
  });

  revalidatePath("/propostas");
}

export async function createProposalFromPdfAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const parsed = proposalPdfSchema.parse(formDataToObject(formData));

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      client_id: parsed.client_id,
      title: parsed.title,
      value: parsed.value,
      valid_until: parsed.valid_until,
      stage: parsed.stage,
      service_type: parsed.service_type,
      comments: parsed.comments,
      sent_at: parsed.stage === "sent" ? new Date().toISOString().slice(0, 10) : null,
      owner_id: user.id,
      payment_status: "pagamento_nao_efetuado",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .insert({
      entity_type: "proposal",
      entity_id: proposal.id,
      file_path: parsed.file_path,
      file_name: parsed.file_name,
      mime_type: parsed.mime_type,
      size_bytes: parsed.size_bytes,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (attachmentError) throw new Error(attachmentError.message);

  await logAudit(supabase, {
    action: "proposal.created_from_pdf",
    entityType: "proposal",
    entityId: proposal.id,
    metadata: { attachment_id: attachment.id, file_name: parsed.file_name },
  });

  revalidatePath("/propostas");
  revalidatePath("/anexos");

  return {
    ok: true,
    message: "Proposta anexada e criada no Kanban.",
    proposalId: proposal.id,
  };
}

export async function createProposalModelDraftAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const parsed = proposalModelDraftSchema.parse(formDataToObject(formData));

  const comments = [
    "Rascunho criado pelo modelo do sistema.",
    parsed.demand ? `Demanda: ${parsed.demand}` : null,
    parsed.sections ? `Secoes: ${parsed.sections}` : null,
    parsed.model_name ? `Modelo: ${parsed.model_name}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      client_id: parsed.client_id,
      title: parsed.title,
      description: parsed.demand,
      value: parsed.value,
      sent_at: parsed.sent_at,
      valid_until: parsed.valid_until,
      comments,
      service_type: parsed.service_type,
      stage: "todo",
      owner_id: user.id,
      payment_status: "pagamento_nao_efetuado",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "proposal.model_draft_created",
    entityType: "proposal",
    entityId: data.id,
    metadata: {
      model_name: parsed.model_name,
      service_type: parsed.service_type,
    },
  });

  revalidatePath("/propostas");

  return {
    ok: true,
    message: "Rascunho de proposta criado em Propostas a Fazer.",
    proposalId: data.id,
  };
}

export async function moveProposalAction(
  proposalId: string,
  stage: ProposalStage,
  position = 0,
) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  if (stage === "execution") {
    const result = await convertProposalToService(proposalId);
    const { error: positionError } = await supabase
      .from("proposals")
      .update({ position })
      .eq("id", proposalId);
    if (positionError) throw new Error(positionError.message);
    revalidatePath("/propostas");
    return result;
  }

  const { error } = await supabase
    .from("proposals")
    .update({ stage, position })
    .eq("id", proposalId);

  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    action: "proposal.moved",
    entityType: "proposal",
    entityId: proposalId,
    metadata: { stage },
  });

  revalidatePath("/propostas");
}

export async function convertProposalAction(proposalId: string) {
  return convertProposalToService(proposalId);
}

export async function convertProposalToService(proposalId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);

  const proposal = await getProposal(supabase, proposalId);
  const targetColumn = await resolveTargetServiceColumn(supabase, proposal);
  const contract = await getOrCreateContract(supabase, proposal, user.id);
  const card = await getOrCreateServiceCard(
    supabase,
    proposal,
    contract.id,
    targetColumn.id,
    user.id,
  );

  if (contract.service_card_id !== card.id || contract.status !== "em_execucao") {
    const { error: contractUpdateError } = await supabase
      .from("contracts")
      .update(buildContractExecutionUpdate(card.id))
      .eq("id", contract.id);
    if (contractUpdateError) throw new Error(contractUpdateError.message);
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update(
      buildProposalExecutionUpdate({
        proposal,
        contractId: contract.id,
        serviceCardId: card.id,
        convertedAt: new Date().toISOString(),
      }),
    )
    .eq("id", proposal.id);
  if (updateError) throw new Error(updateError.message);

  await logAudit(supabase, {
    action: "proposal.converted_to_service",
    entityType: "proposal",
    entityId: proposal.id,
    metadata: {
      service_card_id: card.id,
      contract_id: contract.id,
      service_column_id: targetColumn.id,
      service_type: proposal.service_type,
    },
  });

  revalidatePhase1Paths(card.id);

  return {
    ok: true,
    message: "Proposta convertida. Contrato e servico tecnico foram vinculados.",
    contractId: contract.id,
    serviceCardId: card.id,
  };
}

export async function markProposalPaymentAsPaid(proposalId: string) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  let proposal = await getProposal(supabase, proposalId);
  if (proposal.stage !== "execution" || !proposal.service_card_id || !proposal.contract_id) {
    await convertProposalToService(proposal.id);
    proposal = await getProposal(supabase, proposalId);
  }

  const serviceCardId = proposal.service_card_id ?? proposal.converted_service_card_id;
  if (!proposal.contract_id || !serviceCardId) {
    throw new Error("Converta a proposta em servico antes de marcar pagamento.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const revenue = await getOrCreatePaidRevenue(
    supabase,
    proposal,
    proposal.contract_id,
    serviceCardId,
    today,
  );

  await updatePaymentStatus(supabase, proposal.id, serviceCardId, "pagamento_efetuado");

  await logAudit(supabase, {
    action: "proposal.payment_marked_paid",
    entityType: "proposal",
    entityId: proposal.id,
    metadata: {
      revenue_id: revenue.id,
      contract_id: proposal.contract_id,
      service_card_id: serviceCardId,
    },
  });

  revalidatePhase1Paths(serviceCardId);

  return {
    ok: true,
    message: "Pagamento registrado. Receita paga criada no financeiro.",
    revenueId: revenue.id,
  };
}

export async function revertProposalFromService(proposalId: string) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  const proposal = await getProposal(supabase, proposalId);
  const serviceCardId = proposal.service_card_id ?? proposal.converted_service_card_id;
  const contractId = proposal.contract_id;

  if (contractId) {
    const { error: contractError } = await supabase
      .from("contracts")
      .update(buildContractCancelUpdate())
      .eq("id", contractId);
    if (contractError) throw new Error(contractError.message);
  }

  await deleteAutomaticRevenues(supabase, proposal.id);

  if (serviceCardId) {
    const { error: deleteCardError } = await supabase
      .from("service_cards")
      .delete()
      .eq("id", serviceCardId)
      .eq("proposal_id", proposal.id);
    if (deleteCardError) throw new Error(deleteCardError.message);
  }

  const { error: proposalError } = await supabase
    .from("proposals")
    .update(buildProposalRevertUpdate())
    .eq("id", proposal.id);
  if (proposalError) throw new Error(proposalError.message);

  await logAudit(supabase, {
    action: "proposal.reverted_from_service",
    entityType: "proposal",
    entityId: proposal.id,
    metadata: { contract_id: contractId, service_card_id: serviceCardId },
  });

  revalidatePhase1Paths(serviceCardId ?? undefined);

  return {
    ok: true,
    message: "Servico revertido. A proposta voltou para Propostas Enviadas.",
  };
}

export async function revertServiceToProposal(serviceCardId: string) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  const { data: card, error } = await supabase
    .from("service_cards")
    .select("id,proposal_id,created_from_proposal_id")
    .eq("id", serviceCardId)
    .single();
  if (error) throw new Error(error.message);

  const proposalId = card.proposal_id ?? card.created_from_proposal_id;
  if (!proposalId) {
    throw new Error("Este card nao esta vinculado a uma proposta.");
  }

  return revertProposalFromService(proposalId);
}

function revalidatePhase1Paths(serviceCardId?: string) {
  revalidatePath("/propostas");
  revalidatePath("/contratos");
  revalidatePath("/servicos");
  revalidatePath("/financeiro");
  if (serviceCardId) revalidatePath(`/servicos/${serviceCardId}`);
}

async function getProposal(supabase: ServerSupabase, proposalId: string): Promise<Proposal> {
  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (error) throw new Error(error.message);
  return proposal;
}

async function resolveTargetServiceColumn(
  supabase: ServerSupabase,
  proposal: Proposal,
): Promise<ServiceColumn> {
  const desiredSlug = resolveBoardSlugForProposal(proposal);
  const { data: desiredBoard } = await supabase
    .from("service_boards")
    .select("*")
    .eq("slug", desiredSlug)
    .maybeSingle();

  let board: ServiceBoard | null = desiredBoard;
  if (!board) {
    const { data: fallbackBoard } = await supabase
      .from("service_boards")
      .select("*")
      .eq("slug", "outros-servicos")
      .maybeSingle();
    board = fallbackBoard;
  }

  if (!board) {
    throw new Error("Nenhum quadro de servicos encontrado. Execute o seed de service_boards e service_columns.");
  }

  const { data: columns, error } = await supabase
    .from("service_columns")
    .select("*")
    .eq("board_id", board.id)
    .order("position");
  if (error) throw new Error(error.message);

  const activeColumn = chooseFirstActiveServiceColumn(columns ?? []);

  if (!activeColumn) {
    throw new Error(`Nenhuma coluna ativa encontrada para o quadro ${board.name}.`);
  }

  return activeColumn;
}

async function getOrCreateContract(
  supabase: ServerSupabase,
  proposal: Proposal,
  userId: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("contracts")
    .select("*")
    .eq("proposal_id", proposal.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("contracts")
    .insert(
      buildContractInsertFromProposal({
        proposal,
        userId,
        startsAt: new Date().toISOString().slice(0, 10),
      }),
    )
    .select("*")
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from("contracts")
      .select("*")
      .eq("proposal_id", proposal.id)
      .maybeSingle();
    if (retry) return retry;
    throw new Error(error.message);
  }

  await logAudit(supabase, {
    action: "contract.created_from_proposal",
    entityType: "contract",
    entityId: data.id,
    metadata: { proposal_id: proposal.id },
  });

  return data;
}

async function getOrCreateServiceCard(
  supabase: ServerSupabase,
  proposal: Proposal,
  contractId: string,
  columnId: string,
  userId: string,
) {
  const { data: existingRows, error: existingError } = await supabase
    .from("service_cards")
    .select("*")
    .or(`proposal_id.eq.${proposal.id},created_from_proposal_id.eq.${proposal.id}`)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  const existing = existingRows?.[0] ?? null;

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("service_cards")
      .update(
        buildServiceCardUpdateFromProposal({
          existing,
          proposal,
          contractId,
          columnId,
          userId,
        }),
      )
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return updated;
  }

  const { data, error } = await supabase
    .from("service_cards")
    .insert(
      buildServiceCardInsertFromProposal({
        proposal,
        contractId,
        columnId,
        userId,
      }),
    )
    .select("*")
    .single();

  if (error) {
    const { data: retryRows } = await supabase
      .from("service_cards")
      .select("*")
      .eq("proposal_id", proposal.id)
      .limit(1);
    const retry = retryRows?.[0] ?? null;
    if (retry) return retry;
    throw new Error(error.message);
  }

  return data;
}

async function getOrCreatePaidRevenue(
  supabase: ServerSupabase,
  proposal: Proposal,
  contractId: string,
  serviceCardId: string,
  paidAt: string,
) {
  const { data: existingRows, error: existingError } = await supabase
    .from("revenues")
    .select("*")
    .eq("proposal_id", proposal.id)
    .eq("auto_generated", true)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  const existing = existingRows?.[0] ?? null;

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("revenues")
      .update(buildPaidRevenueUpdate({ existing, contractId, serviceCardId, paidAt }))
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return updated;
  }

  const { data, error } = await supabase
    .from("revenues")
    .insert(
      buildPaidRevenueInsertFromProposal({
        proposal,
        contractId,
        serviceCardId,
        paidAt,
      }),
    )
    .select("*")
    .single();

  if (error) {
    const { data: retryRows } = await supabase
      .from("revenues")
      .select("*")
      .eq("proposal_id", proposal.id)
      .eq("auto_generated", true)
      .limit(1);
    const retry = retryRows?.[0] ?? null;
    if (retry) return retry;
    throw new Error(error.message);
  }

  return data;
}

async function updatePaymentStatus(
  supabase: ServerSupabase,
  proposalId: string,
  serviceCardId: string,
  paymentStatus: PaymentStatus,
) {
  const { error: proposalError } = await supabase
    .from("proposals")
    .update(buildPaymentStatusUpdate(paymentStatus))
    .eq("id", proposalId);
  if (proposalError) throw new Error(proposalError.message);

  const { error: cardError } = await supabase
    .from("service_cards")
    .update({ payment_status: paymentStatus })
    .eq("id", serviceCardId);
  if (cardError) throw new Error(cardError.message);
}

async function deleteAutomaticRevenues(supabase: ServerSupabase, proposalId: string) {
  const { error } = await supabase
    .from("revenues")
    .delete()
    .eq("proposal_id", proposalId)
    .eq("auto_generated", true);
  if (error) throw new Error(error.message);
}
