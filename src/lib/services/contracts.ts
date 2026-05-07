import { normalizeProposalServiceType } from "@/lib/services/proposals";
import type { Database, Proposal } from "@/types/database";

export function buildContractInsertFromProposal({
  proposal,
  userId,
  startsAt,
}: {
  proposal: Proposal;
  userId: string;
  startsAt: string;
}): Database["public"]["Tables"]["contracts"]["Insert"] {
  const serviceType = normalizeProposalServiceType(proposal);

  return {
    client_id: proposal.client_id,
    proposal_id: proposal.id,
    title: `Contrato - ${proposal.title}`,
    description: proposal.description,
    amount: proposal.value,
    status: "contrato_a_gerar",
    starts_at: startsAt,
    ends_at: proposal.valid_until,
    important_dates_json: {
      proposal_valid_until: proposal.valid_until,
      service_type: serviceType,
    },
    created_by: userId,
  };
}

export function buildContractExecutionUpdate(
  serviceCardId: string,
): Database["public"]["Tables"]["contracts"]["Update"] {
  return {
    service_card_id: serviceCardId,
    status: "em_execucao",
  };
}

export function buildContractCancelUpdate(): Database["public"]["Tables"]["contracts"]["Update"] {
  return {
    status: "cancelado",
    service_card_id: null,
  };
}
