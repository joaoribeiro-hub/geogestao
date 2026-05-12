import type { Database, Proposal, Revenue } from "@/types/database";

export function buildPaidRevenueInsertFromProposal({
  proposal,
  contractId,
  serviceCardId,
  paidAt,
}: {
  proposal: Proposal;
  contractId: string;
  serviceCardId: string;
  paidAt: string;
}): Database["public"]["Tables"]["revenues"]["Insert"] {
  return {
    client_id: proposal.client_id,
    proposal_id: proposal.id,
    contract_id: contractId,
    service_card_id: serviceCardId,
    description: `Pagamento recebido - ${proposal.title}`,
    category: "Pagamento de proposta",
    amount: proposal.value ?? 0,
    due_date: paidAt,
    paid_at: paidAt,
    status: "paid",
    auto_generated: true,
  };
}

export function buildPendingRevenueInsertFromProposal({
  proposal,
  contractId,
  serviceCardId,
  dueDate,
}: {
  proposal: Proposal;
  contractId: string;
  serviceCardId: string;
  dueDate: string;
}): Database["public"]["Tables"]["revenues"]["Insert"] {
  return {
    client_id: proposal.client_id,
    proposal_id: proposal.id,
    contract_id: contractId,
    service_card_id: serviceCardId,
    description: `Pagamento a receber - ${proposal.title}`,
    category: "Pagamento de proposta",
    amount: proposal.value ?? 0,
    due_date: dueDate,
    paid_at: null,
    status: "pending",
    auto_generated: true,
  };
}

export function buildPaidRevenueUpdate({
  existing,
  contractId,
  serviceCardId,
  paidAt,
  proposalTitle,
}: {
  existing: Revenue;
  contractId: string;
  serviceCardId: string;
  paidAt: string;
  proposalTitle?: string;
}): Database["public"]["Tables"]["revenues"]["Update"] {
  return {
    contract_id: contractId,
    service_card_id: serviceCardId,
    description: `Pagamento recebido - ${proposalTitle ?? stripPaymentPrefix(existing.description)}`,
    status: "paid",
    paid_at: existing.paid_at ?? paidAt,
  };
}

export function buildPendingRevenueUpdate({
  existing,
  contractId,
  serviceCardId,
  dueDate,
  proposalTitle,
}: {
  existing: Revenue;
  contractId: string;
  serviceCardId: string;
  dueDate: string;
  proposalTitle?: string;
}): Database["public"]["Tables"]["revenues"]["Update"] {
  return {
    contract_id: contractId,
    service_card_id: serviceCardId,
    description: `Pagamento a receber - ${proposalTitle ?? stripPaymentPrefix(existing.description)}`,
    due_date: existing.due_date ?? dueDate,
    status: "pending",
    paid_at: null,
  };
}

export function calculateFinanceTotals(
  rows: Array<{ amount: number | null | undefined }>,
) {
  return rows.reduce((total, row) => total + Number(row.amount ?? 0), 0);
}

function stripPaymentPrefix(value: string) {
  return value.replace(/^Pagamento (a receber|recebido) - /, "");
}
