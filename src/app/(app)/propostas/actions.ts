"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { proposalSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Proposal, ProposalStage, ServiceBoard, ServiceColumn } from "@/types/database";

export async function createProposalAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const parsed = proposalSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("proposals")
    .insert({ ...parsed, owner_id: user.id, stage: "todo" })
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

export async function moveProposalAction(
  proposalId: string,
  stage: ProposalStage,
  position = 0,
) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

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
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (proposalError) throw new Error(proposalError.message);

  const targetColumn = await resolveTargetServiceColumn(supabase, proposal);
  const contract = await getOrCreateContract(supabase, proposal, user.id);
  const card = await getOrCreateServiceCard(
    supabase,
    proposal,
    contract.id,
    targetColumn.id,
    user.id,
  );
  const revenue = await getOrCreateRevenue(supabase, proposal, contract.id, card.id);

  if (contract.service_card_id !== card.id || contract.status !== "em_execucao") {
    const { error: contractUpdateError } = await supabase
      .from("contracts")
      .update({ service_card_id: card.id, status: "em_execucao" })
      .eq("id", contract.id);
    if (contractUpdateError) throw new Error(contractUpdateError.message);
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      stage: "execution",
      converted_service_card_id: card.id,
    })
    .eq("id", proposal.id);
  if (updateError) throw new Error(updateError.message);

  await logAudit(supabase, {
    action: "proposal.converted_to_service",
    entityType: "proposal",
    entityId: proposal.id,
    metadata: {
      service_card_id: card.id,
      contract_id: contract.id,
      revenue_id: revenue.id,
      service_column_id: targetColumn.id,
    },
  });

  revalidatePath("/propostas");
  revalidatePath("/contratos");
  revalidatePath("/servicos");
  revalidatePath("/financeiro");

  return {
    ok: true,
    message: "Proposta convertida. Contrato, servico e receita pendente foram vinculados.",
    contractId: contract.id,
    serviceCardId: card.id,
    revenueId: revenue.id,
  };
}

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

function inferBoardSlug(proposal: Proposal) {
  const text = [proposal.title, proposal.description, proposal.comments]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bcar\b|cadastro ambiental/.test(text)) return "car";
  if (/\bitr\b|ccir/.test(text)) return "itr-ccir";
  if (/geo|georreferenciamento|sigef|incra/.test(text)) return "georreferenciamento";

  return "outros-servicos";
}

async function resolveTargetServiceColumn(
  supabase: ServerSupabase,
  proposal: Proposal,
): Promise<ServiceColumn> {
  const desiredSlug = inferBoardSlug(proposal);
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

  const activeColumn = (columns ?? []).find(
    (column) =>
      !/conclu|finaliz|cancelad/.test(`${column.slug} ${column.name}`.toLowerCase()),
  );

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
    .insert({
      client_id: proposal.client_id,
      proposal_id: proposal.id,
      title: `Contrato - ${proposal.title}`,
      description: proposal.description,
      amount: proposal.value,
      status: "contrato_a_gerar",
      starts_at: new Date().toISOString().slice(0, 10),
      ends_at: proposal.valid_until,
      important_dates_json: {
        proposal_valid_until: proposal.valid_until,
      },
      created_by: userId,
    })
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
  const { data: existing, error: existingError } = await supabase
    .from("service_cards")
    .select("*")
    .or(`proposal_id.eq.${proposal.id},created_from_proposal_id.eq.${proposal.id}`)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const customFields =
      typeof existing.custom_fields_json === "object" && existing.custom_fields_json
        ? existing.custom_fields_json
        : {};
    const shouldMoveToTarget = !existing.proposal_id || !existing.contract_id;
    const { data: updated, error: updateError } = await supabase
      .from("service_cards")
      .update({
        proposal_id: proposal.id,
        contract_id: contractId,
        client_id: proposal.client_id,
        owner_id: existing.owner_id ?? userId,
        column_id: shouldMoveToTarget ? columnId : existing.column_id,
        custom_fields_json: {
          ...customFields,
          valor_proposta: proposal.value,
          contract_id: contractId,
        },
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return updated;
  }

  const { data, error } = await supabase
    .from("service_cards")
    .insert({
      column_id: columnId,
      client_id: proposal.client_id,
      owner_id: userId,
      proposal_id: proposal.id,
      contract_id: contractId,
      title: proposal.title,
      description: proposal.description,
      priority: "medium",
      due_date: proposal.valid_until,
      created_from_proposal_id: proposal.id,
      custom_fields_json: {
        valor_proposta: proposal.value,
        contract_id: contractId,
      },
    })
    .select("*")
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from("service_cards")
      .select("*")
      .eq("proposal_id", proposal.id)
      .maybeSingle();
    if (retry) return retry;
    throw new Error(error.message);
  }

  return data;
}

async function getOrCreateRevenue(
  supabase: ServerSupabase,
  proposal: Proposal,
  contractId: string,
  serviceCardId: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("revenues")
    .select("*")
    .eq("proposal_id", proposal.id)
    .eq("category", "Proposta aprovada")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("revenues")
      .update({
        contract_id: contractId,
        service_card_id: serviceCardId,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return updated;
  }

  const dueDate =
    proposal.valid_until ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("revenues")
    .insert({
      client_id: proposal.client_id,
      proposal_id: proposal.id,
      contract_id: contractId,
      service_card_id: serviceCardId,
      description: `Receita prevista - ${proposal.title}`,
      category: "Proposta aprovada",
      amount: proposal.value ?? 0,
      due_date: dueDate,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from("revenues")
      .select("*")
      .eq("proposal_id", proposal.id)
      .eq("category", "Proposta aprovada")
      .maybeSingle();
    if (retry) return retry;
    throw new Error(error.message);
  }

  await logAudit(supabase, {
    action: "revenue.created_from_proposal",
    entityType: "revenue",
    entityId: data.id,
    metadata: {
      proposal_id: proposal.id,
      contract_id: contractId,
      service_card_id: serviceCardId,
    },
  });

  return data;
}
