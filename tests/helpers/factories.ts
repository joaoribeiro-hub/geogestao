import type { Proposal, Revenue, ServiceCard, ServiceColumn } from "@/types/database";

const now = "2026-05-06T12:00:00.000Z";

export function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "proposal-1",
    created_at: now,
    updated_at: now,
    organization_id: "organization-1",
    client_id: "client-1",
    title: "Georreferenciamento Fazenda Boa Vista",
    description: "Servico de georreferenciamento para SIGEF.",
    value: 12500,
    owner_id: "user-1",
    sent_at: "2026-05-01",
    valid_until: "2026-06-01",
    comments: null,
    service_type: "georreferenciamento",
    payment_status: "pagamento_nao_efetuado",
    converted_at: null,
    contract_id: null,
    service_card_id: null,
    model_data: {},
    pdf_file_path: null,
    pdf_generated_at: null,
    lost_at: null,
    lost_reason: null,
    stage: "sent",
    position: 0,
    converted_service_card_id: null,
    ...overrides,
  };
}

export function makeServiceColumn(
  overrides: Partial<ServiceColumn> = {},
): ServiceColumn {
  return {
    id: "column-1",
    created_at: now,
    updated_at: now,
    board_id: "board-1",
    name: "A Fazer",
    slug: "a-fazer",
    position: 0,
    ...overrides,
  };
}

export function makeServiceCard(overrides: Partial<ServiceCard> = {}): ServiceCard {
  return {
    id: "card-1",
    created_at: now,
    updated_at: now,
    organization_id: "organization-1",
    column_id: "column-old",
    client_id: "client-old",
    owner_id: null,
    proposal_id: null,
    contract_id: null,
    service_type: null,
    payment_status: "pagamento_nao_efetuado",
    title: "Card tecnico existente",
    description: null,
    priority: "medium",
    service_date: "2026-05-06",
    due_date: null,
    completed_at: null,
    municipality: null,
    responsible_user_id: null,
    payment_condition: null,
    custom_service_name: null,
    checklist_percent: 0,
    custom_fields_json: { existente: true },
    position: 0,
    created_from_proposal_id: "proposal-1",
    ...overrides,
  };
}

export function makeRevenue(overrides: Partial<Revenue> = {}): Revenue {
  return {
    id: "revenue-1",
    created_at: now,
    updated_at: now,
    organization_id: "organization-1",
    client_id: "client-1",
    proposal_id: "proposal-1",
    service_card_id: "card-1",
    contract_id: "contract-1",
    auto_generated: true,
    description: "Pagamento recebido - Georreferenciamento Fazenda Boa Vista",
    category: "Pagamento de proposta",
    amount: 12500,
    expected_amount: 12500,
    realized_amount: null,
    due_date: "2026-05-06",
    paid_at: null,
    bank_account: null,
    notes: null,
    status: "pending",
    ...overrides,
  };
}
