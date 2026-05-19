import { describe, expect, it } from "vitest";
import {
  buildServiceSummary,
  getDefaultChecklistItems,
  getExecutionColumn,
  getInitialServiceColumn,
  getNextColumn,
  getServiceColumns,
  serviceWorkflowDefinitions,
  serviceFlowSlugs,
} from "@/lib/services/service-flow";
import type { ServiceCard, ServiceColumn } from "@/types/database";

const columns = [
  column("1", serviceFlowSlugs.awaitingDocuments, "Aguardando documentos", 1),
  column("2", serviceFlowSlugs.proposalContract, "Proposta/Contrato", 2),
  column("3", serviceFlowSlugs.inProgress, "Geo em Andamento", 3),
  column("4", serviceFlowSlugs.priority, "Prioridade", 4),
] as ServiceColumn[];

describe("service-flow", () => {
  it("coloca novo servico em Aguardando documentos", () => {
    expect(getInitialServiceColumn(columns)?.slug).toBe(serviceFlowSlugs.awaitingDocuments);
  });

  it("prioridade alta entra na coluna Prioridade ao ir para execucao", () => {
    expect(getExecutionColumn(columns, "high")?.slug).toBe(serviceFlowSlugs.priority);
    expect(getExecutionColumn(columns, "medium")?.slug).toBe(serviceFlowSlugs.inProgress);
  });

  it("botao Proximo move para a coluna a direita", () => {
    expect(getNextColumn(columns, "2")?.id).toBe("3");
  });

  it("gera checklist padrao por tipo de servico", () => {
    expect(getDefaultChecklistItems("georreferenciamento")).toContain("Matricula");
    expect(getDefaultChecklistItems("car")).toContain("Recibo/demonstrativo");
    expect(getDefaultChecklistItems("itr_ccir")).toContain("ITR anterior");
  });

  it("define colunas iniciais por tipo de servico", () => {
    expect(serviceWorkflowDefinitions.georreferenciamento.map((item) => item.name)).toEqual([
      "Aguardando documentos",
      "Proposta/Contrato",
      "Geo em Andamento",
      "Prioridade",
      "Geo Protocolado no Cartorio",
      "Geo Protocolado no INCRA",
      "Geo - Pendencia de Confrontante",
      "Geo Concluido",
      "Servico perdido",
    ]);
    expect(serviceWorkflowDefinitions.car.some((item) => item.name === "CAR em Andamento")).toBe(true);
    expect(serviceWorkflowDefinitions.itr_ccir.some((item) => item.name === "ITR/CCIR em Andamento")).toBe(true);
    expect(serviceWorkflowDefinitions.outros_servicos.some((item) => item.name === "Em Andamento")).toBe(true);
    expect(serviceWorkflowDefinitions.car.some((item) => item.slug === serviceFlowSlugs.lost)).toBe(true);
    expect(serviceWorkflowDefinitions.itr_ccir.some((item) => item.slug === serviceFlowSlugs.lost)).toBe(true);
    expect(serviceWorkflowDefinitions.outros_servicos.some((item) => item.slug === serviceFlowSlugs.lost)).toBe(true);
  });

  it("filtra colunas do workflow do tipo selecionado quando elas existem", () => {
    const mixed = [
      column("1", "aguardando-documentos", "Aguardando documentos", 1),
      column("2", "car-em-andamento", "CAR em Andamento", 3),
      column("3", "geo-em-andamento", "Geo em Andamento", 3),
    ] as ServiceColumn[];

    expect(getServiceColumns("car", mixed).map((item) => item.slug)).toEqual([
      "aguardando-documentos",
      "car-em-andamento",
    ]);
  });

  it("resume servico sem cliente com proxima acao", () => {
    const summary = buildServiceSummary({
      card: {
        priority: "medium",
        due_date: null,
        payment_status: "pagamento_nao_efetuado",
        checklist_percent: 0,
      } as ServiceCard,
      columnName: "Aguardando documentos",
      hasClient: false,
      attachmentCount: 0,
    });

    expect(summary).toContain("sem cliente vinculado");
    expect(summary).toContain("Pagamento ainda nao efetuado");
  });
});

function column(id: string, slug: string, name: string, position: number) {
  return {
    id,
    slug,
    name,
    position,
    board_id: "board-1",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}
