import { normalizeProposalServiceType } from "@/lib/services/proposals";
import type {
  Database,
  Json,
  Proposal,
  ProposalServiceType,
  ServiceCard,
  ServiceColumn,
} from "@/types/database";

export const serviceTypeToBoardSlug: Record<ProposalServiceType, string> = {
  georreferenciamento: "georreferenciamento",
  car: "car",
  itr_ccir: "itr-ccir",
  outros_servicos: "outros-servicos",
};

export function resolveBoardSlugForProposal(proposal: Proposal): string {
  return serviceTypeToBoardSlug[normalizeProposalServiceType(proposal)];
}

export function chooseFirstActiveServiceColumn(
  columns: ServiceColumn[],
): ServiceColumn | null {
  return (
    columns.find(
      (column) =>
        !/conclu|finaliz|cancelad/.test(`${column.slug} ${column.name}`.toLowerCase()),
    ) ?? null
  );
}

export function buildServiceCardInsertFromProposal({
  proposal,
  contractId,
  columnId,
  userId,
}: {
  proposal: Proposal;
  contractId: string;
  columnId: string;
  userId: string;
}): Database["public"]["Tables"]["service_cards"]["Insert"] {
  const serviceType = normalizeProposalServiceType(proposal);

  return {
    column_id: columnId,
    client_id: proposal.client_id,
    owner_id: userId,
    proposal_id: proposal.id,
    contract_id: contractId,
    service_type: serviceType,
    payment_status: "pagamento_nao_efetuado",
    title: proposal.title,
    description: proposal.description,
    priority: "medium",
    due_date: proposal.valid_until,
    created_from_proposal_id: proposal.id,
    custom_fields_json: {
      valor_proposta: proposal.value,
      contract_id: contractId,
      tipo_servico: serviceType,
    },
  };
}

export function buildServiceCardUpdateFromProposal({
  existing,
  proposal,
  contractId,
  columnId,
  userId,
}: {
  existing: ServiceCard;
  proposal: Proposal;
  contractId: string;
  columnId: string;
  userId: string;
}): Database["public"]["Tables"]["service_cards"]["Update"] {
  const serviceType = normalizeProposalServiceType(proposal);

  return {
    proposal_id: proposal.id,
    contract_id: contractId,
    client_id: proposal.client_id,
    owner_id: existing.owner_id ?? userId,
    column_id: columnId,
    service_type: serviceType,
    payment_status: proposal.payment_status ?? "pagamento_nao_efetuado",
    title: existing.title || proposal.title,
    description: existing.description ?? proposal.description,
    due_date: existing.due_date ?? proposal.valid_until,
    custom_fields_json: {
      ...asRecord(existing.custom_fields_json),
      valor_proposta: proposal.value,
      contract_id: contractId,
      tipo_servico: serviceType,
    },
  };
}

function asRecord(value: Json): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}
