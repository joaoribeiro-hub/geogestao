import { describe, expect, it } from "vitest";
import {
  filterServiceCardsByOperationalPeriod,
  isServiceOverdue,
  serviceIntersectsPeriod,
} from "@/lib/services/service-period";
import type { ServiceCard, ServiceColumn } from "@/types/database";

describe("service-period", () => {
  const activeColumn = { id: "active", slug: "geo-em-andamento", name: "Geo em Andamento" } as ServiceColumn;
  const finishedColumn = { id: "done", slug: "geo-concluido", name: "Geo Concluido" } as ServiceColumn;
  const lostColumn = { id: "lost", slug: "servico-perdido", name: "Servico perdido" } as ServiceColumn;
  const columns = new Map([
    [activeColumn.id, activeColumn],
    [finishedColumn.id, finishedColumn],
    [lostColumn.id, lostColumn],
  ]);

  it("inclui servico criado hoje com prazo futuro no filtro deste mes", () => {
    const card = serviceCard({
      service_date: "2026-05-19",
      due_date: "2026-07-20",
      column_id: activeColumn.id,
    });

    expect(
      serviceIntersectsPeriod(card, activeColumn, {
        period: "this_month",
        from: "2026-05-01",
        to: "2026-05-31",
      }),
    ).toBe(true);
  });

  it("filtra por intersecao entre data operacional e prazo", () => {
    const card = serviceCard({
      service_date: "2026-04-15",
      due_date: "2026-06-10",
      column_id: activeColumn.id,
    });

    expect(
      serviceIntersectsPeriod(card, activeColumn, {
        period: "custom",
        from: "2026-05-01",
        to: "2026-05-31",
      }),
    ).toBe(true);
    expect(
      serviceIntersectsPeriod(card, activeColumn, {
        period: "custom",
        from: "2026-07-01",
        to: "2026-07-31",
      }),
    ).toBe(false);
  });

  it("mantem servico atrasado visivel mesmo fora do periodo", () => {
    const overdue = serviceCard({
      service_date: "2026-01-01",
      due_date: "2026-02-01",
      column_id: activeColumn.id,
    });
    const future = serviceCard({
      service_date: "2026-01-01",
      due_date: "2026-02-01",
      column_id: finishedColumn.id,
      completed_at: "2026-02-01",
    });

    expect(isServiceOverdue(overdue, activeColumn, "2026-05-19")).toBe(true);
    expect(isServiceOverdue(future, finishedColumn, "2026-05-19")).toBe(false);
    expect(
      filterServiceCardsByOperationalPeriod(
        [overdue, future],
        columns,
        { period: "custom", from: "2026-05-01", to: "2026-05-31" },
        "2026-05-19",
      ).map((item) => item.id),
    ).toEqual(["service"]);
  });

  it("nao marca servico perdido como atrasado", () => {
    const lost = serviceCard({
      service_date: "2026-01-01",
      due_date: "2026-02-01",
      column_id: lostColumn.id,
    });

    expect(isServiceOverdue(lost, lostColumn, "2026-05-19")).toBe(false);
  });
});

function serviceCard(patch: Partial<ServiceCard>) {
  return {
    id: "service",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    organization_id: "org",
    column_id: "active",
    client_id: null,
    owner_id: null,
    proposal_id: null,
    contract_id: null,
    service_type: "georreferenciamento",
    payment_status: "pagamento_nao_efetuado",
    title: "Servico",
    description: null,
    priority: "medium",
    service_date: null,
    due_date: null,
    completed_at: null,
    checklist_percent: 0,
    custom_fields_json: {},
    position: 0,
    created_from_proposal_id: null,
    ...patch,
  } as ServiceCard;
}
