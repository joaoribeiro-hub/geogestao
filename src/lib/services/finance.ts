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

export function buildPaidRevenueUpdate({
  existing,
  contractId,
  serviceCardId,
  paidAt,
}: {
  existing: Revenue;
  contractId: string;
  serviceCardId: string;
  paidAt: string;
}): Database["public"]["Tables"]["revenues"]["Update"] {
  return {
    contract_id: contractId,
    service_card_id: serviceCardId,
    status: "paid",
    paid_at: existing.paid_at ?? paidAt,
  };
}

export function calculateFinanceTotals(
  rows: Array<{ amount: number | null | undefined }>,
) {
  return rows.reduce((total, row) => total + Number(row.amount ?? 0), 0);
}
