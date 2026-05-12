import { describe, expect, it } from "vitest";
import {
  buildContractCancelUpdate,
  buildContractExecutionUpdate,
  buildContractInsertFromProposal,
} from "@/lib/services/contracts";
import {
  buildPaidRevenueInsertFromProposal,
  buildPaidRevenueUpdate,
  buildPendingRevenueInsertFromProposal,
  buildPendingRevenueUpdate,
  calculateFinanceTotals,
} from "@/lib/services/finance";
import {
  buildPaymentStatusUpdate,
  buildProposalExecutionUpdate,
  buildProposalLostUpdate,
  buildProposalRevertUpdate,
  normalizeProposalServiceType,
} from "@/lib/services/proposals";
import {
  buildServiceCardInsertFromProposal,
  buildServiceCardUpdateFromProposal,
  chooseFirstActiveServiceColumn,
  resolveBoardSlugForProposal,
} from "@/lib/services/service-cards";
import {
  makeProposal,
  makeRevenue,
  makeServiceCard,
  makeServiceColumn,
} from "../helpers/factories";

describe("regras do fluxo proposta -> contrato -> servico -> financeiro", () => {
  it("normaliza tipo de servico legado e escolhe quadro tecnico correto", () => {
    const legacyProposal = makeProposal({
      service_type: "itr-ccir" as never,
      title: "Regularizacao ITR",
    });
    const inferredProposal = makeProposal({
      service_type: "legado-sem-tipo" as never,
      title: "Cadastro Ambiental Rural",
      description: "Regularizacao CAR",
    });

    expect(normalizeProposalServiceType(legacyProposal)).toBe("itr_ccir");
    expect(normalizeProposalServiceType(inferredProposal)).toBe("car");
    expect(resolveBoardSlugForProposal(makeProposal({ service_type: "itr_ccir" }))).toBe(
      "itr-ccir",
    );
  });

  it("escolhe a primeira coluna ativa e ignora colunas finalizadas", () => {
    const columns = [
      makeServiceColumn({ id: "done", name: "Concluido", slug: "concluido", position: 0 }),
      makeServiceColumn({ id: "active", name: "Triagem", slug: "triagem", position: 1 }),
    ];

    expect(chooseFirstActiveServiceColumn(columns)?.id).toBe("active");
  });

  it("monta contrato e atualizacao de execucao sem criar receita", () => {
    const proposal = makeProposal({ value: 9800, valid_until: "2026-07-01" });

    expect(
      buildContractInsertFromProposal({
        proposal,
        userId: "user-1",
        startsAt: "2026-05-06",
      }),
    ).toMatchObject({
      client_id: "client-1",
      proposal_id: "proposal-1",
      title: "Contrato - Georreferenciamento Fazenda Boa Vista",
      amount: 9800,
      status: "contrato_a_gerar",
      starts_at: "2026-05-06",
      ends_at: "2026-07-01",
      created_by: "user-1",
    });

    expect(buildContractExecutionUpdate("card-1")).toEqual({
      service_card_id: "card-1",
      status: "em_execucao",
    });
  });

  it("monta card tecnico novo no quadro/coluna de destino", () => {
    const proposal = makeProposal({ service_type: "car", payment_status: "pagamento_efetuado" });

    const card = buildServiceCardInsertFromProposal({
      proposal,
      contractId: "contract-1",
      columnId: "column-1",
      userId: "user-1",
    });

    expect(card).toMatchObject({
      column_id: "column-1",
      client_id: "client-1",
      owner_id: "user-1",
      proposal_id: "proposal-1",
      contract_id: "contract-1",
      service_type: "car",
      payment_status: "pagamento_nao_efetuado",
      priority: "medium",
      created_from_proposal_id: "proposal-1",
    });
    expect(card.custom_fields_json).toMatchObject({
      valor_proposta: 12500,
      contract_id: "contract-1",
      tipo_servico: "car",
    });
  });

  it("reaproveita card existente preservando dados manuais quando possivel", () => {
    const update = buildServiceCardUpdateFromProposal({
      existing: makeServiceCard({
        title: "Titulo manual",
        description: "Descricao manual",
        due_date: "2026-08-01",
        custom_fields_json: { observacao_manual: "manter" },
      }),
      proposal: makeProposal({ service_type: "itr_ccir" }),
      contractId: "contract-2",
      columnId: "column-2",
      userId: "user-1",
    });

    expect(update).toMatchObject({
      proposal_id: "proposal-1",
      contract_id: "contract-2",
      client_id: "client-1",
      column_id: "column-2",
      service_type: "itr_ccir",
      title: "Titulo manual",
      description: "Descricao manual",
      due_date: "2026-08-01",
    });
    expect(update.custom_fields_json).toMatchObject({
      observacao_manual: "manter",
      contract_id: "contract-2",
      tipo_servico: "itr_ccir",
    });
  });

  it("atualiza proposta para execucao de forma idempotente", () => {
    const converted = buildProposalExecutionUpdate({
      proposal: makeProposal({ converted_at: "2026-05-01T10:00:00.000Z" }),
      contractId: "contract-1",
      serviceCardId: "card-1",
      convertedAt: "2026-05-06T10:00:00.000Z",
    });

    expect(converted).toEqual({
      stage: "execution",
      contract_id: "contract-1",
      service_card_id: "card-1",
      converted_service_card_id: "card-1",
      converted_at: "2026-05-01T10:00:00.000Z",
      payment_status: "pagamento_nao_efetuado",
    });
  });

  it("pagamento efetuado cria ou reaproveita receita automatica paga", () => {
    const proposal = makeProposal({ value: null });
    const insert = buildPaidRevenueInsertFromProposal({
      proposal,
      contractId: "contract-1",
      serviceCardId: "card-1",
      paidAt: "2026-05-06",
    });
    const update = buildPaidRevenueUpdate({
      existing: makeRevenue({ paid_at: "2026-05-05", status: "pending" }),
      contractId: "contract-2",
      serviceCardId: "card-2",
      paidAt: "2026-05-06",
    });

    expect(insert).toMatchObject({
      proposal_id: "proposal-1",
      amount: 0,
      status: "paid",
      paid_at: "2026-05-06",
      auto_generated: true,
    });
    expect(update).toEqual({
      contract_id: "contract-2",
      service_card_id: "card-2",
      description: "Pagamento recebido - Georreferenciamento Fazenda Boa Vista",
      status: "paid",
      paid_at: "2026-05-05",
    });
    expect(buildPaymentStatusUpdate("pagamento_efetuado")).toEqual({
      payment_status: "pagamento_efetuado",
    });
  });

  it("pagamento nao pago cria ou reaproveita receita pendente a receber", () => {
    const proposal = makeProposal({ value: 5500 });
    const insert = buildPendingRevenueInsertFromProposal({
      proposal,
      contractId: "contract-1",
      serviceCardId: "card-1",
      dueDate: "2026-06-01",
    });
    const update = buildPendingRevenueUpdate({
      existing: makeRevenue({ status: "paid", paid_at: "2026-05-10" }),
      contractId: "contract-1",
      serviceCardId: "card-1",
      dueDate: "2026-06-01",
      proposalTitle: proposal.title,
    });

    expect(insert).toMatchObject({
      description: "Pagamento a receber - Georreferenciamento Fazenda Boa Vista",
      amount: 5500,
      status: "pending",
      paid_at: null,
      auto_generated: true,
    });
    expect(update).toMatchObject({
      description: "Pagamento a receber - Georreferenciamento Fazenda Boa Vista",
      status: "pending",
      paid_at: null,
    });
  });

  it("status nao aprovado move para perdidas e registra valor perdido por proposta", () => {
    expect(
      buildProposalLostUpdate({
        lostAt: "2026-05-09T10:00:00.000Z",
        reason: "Nao aprovado pelo cliente.",
      }),
    ).toEqual({
      stage: "lost",
      lost_at: "2026-05-09T10:00:00.000Z",
      lost_reason: "Nao aprovado pelo cliente.",
    });
  });

  it("voltar cancela contrato, limpa vinculos de servico e reseta pagamento", () => {
    expect(buildContractCancelUpdate()).toEqual({
      status: "cancelado",
      service_card_id: null,
    });
    expect(buildProposalRevertUpdate()).toEqual({
      stage: "sent",
      service_card_id: null,
      converted_service_card_id: null,
      converted_at: null,
      payment_status: "pagamento_nao_efetuado",
    });
  });

  it("soma totais financeiros tolerando valores ausentes", () => {
    expect(calculateFinanceTotals([{ amount: 10 }, { amount: null }, { amount: 5.5 }])).toBe(
      15.5,
    );
  });
});
