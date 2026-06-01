import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ajustes pontuais de Servicos e Clientes", () => {
  it("Kanban nao mostra botoes Proximo/Proposta/Contrato nos cards", () => {
    const kanban = readFileSync(join(process.cwd(), "src/components/kanban/service-kanban.tsx"), "utf8");

    expect(kanban).not.toContain("advanceServiceCardAction");
    expect(kanban).not.toContain("createProposalForServiceAction");
    expect(kanban).not.toContain("createContractForServiceAction");
    expect(kanban).not.toContain(">Proximo<");
  });

  it("Kanban possui barra de rolagem horizontal superior sincronizada", () => {
    const kanban = readFileSync(join(process.cwd(), "src/components/kanban/service-kanban.tsx"), "utf8");

    expect(kanban).toContain("service-kanban-top-scroll");
    expect(kanban).toContain("topScrollRef");
    expect(kanban).toContain("bottomScrollRef");
    expect(kanban).toContain("syncKanbanScroll");
  });

  it("editar servico preserva cliente e oferece busca de cliente no modal", () => {
    const controls = readFileSync(join(process.cwd(), "src/components/services/service-detail-controls.tsx"), "utf8");
    const actions = readFileSync(join(process.cwd(), "src/app/(app)/servicos/actions.ts"), "utf8");

    expect(controls).toContain("Informacoes iniciais");
    expect(controls).toContain("Data de criacao");
    expect(controls).toContain("Buscar cliente pelo nome, CPF/CNPJ ou telefone");
    expect(actions).toContain("const nextClientId = formData.has(\"client_id\") ? parsed.client_id : card.client_id");
    expect(actions).toContain("Cliente selecionado nao pertence a organizacao atual");
    expect(actions).toContain("service_date: parsed.service_date");
  });

  it("cliente detalhado usa visualizacao e financeiro filtravel por servico", () => {
    const clientPage = readFileSync(join(process.cwd(), "src/app/(app)/clientes/[id]/page.tsx"), "utf8");
    const panel = readFileSync(join(process.cwd(), "src/components/clients/client-detail-panels.tsx"), "utf8");

    expect(clientPage).toContain("<ClientEditModal client={client} />");
    expect(clientPage).not.toContain("<ClientForm client={client} />");
    expect(panel).toContain("Servicos ativos");
    expect(panel).toContain("isConcludedServiceColumn");
    expect(panel).toContain("Abrir {selectedService.title}");
  });

  it("migration 038 cria Antigos a concluir em todos os fluxos", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/038_services_clients_adjustments.sql"), "utf8");

    expect(sql.match(/'Antigos a concluir'/g)?.length).toBe(4);
    expect(sql).toContain("on conflict (board_id, slug) do update");
  });

  it("migration 039 ajusta o fluxo CAR sem apagar colunas legadas", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/039_car_service_flow_adjustment.sql"), "utf8");
    const servicesPage = readFileSync(join(process.cwd(), "src/app/(app)/servicos/page.tsx"), "utf8");

    expect(sql).toContain("CAR em Retificacao");
    expect(sql).toContain("Aguardando Sincronizacao");
    expect(sql).toContain("Antigos a concluir");
    expect(sql).toContain("car-protocolado-em-analise");
    expect(sql).toContain("proposta-contrato");
    expect(sql).toContain("notify pgrst");
    expect(servicesPage).toContain("getServiceColumns(selectedServiceType, selectedBoardColumns)");
  });

  it("migration 040 remove Proposta/Contrato do fluxo Georreferenciamento exibido", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/040_geo_service_flow_remove_proposal_contract.sql"),
      "utf8",
    );

    expect(sql).toContain("georreferenciamento");
    expect(sql).toContain("Geo em Andamento");
    expect(sql).toContain("proposta-contrato");
    expect(sql).toContain("aguardando-documentos");
    expect(sql).toContain("notify pgrst");
  });

  it("novo servico permite cadastrar etapas iniciais sem checklist padrao", () => {
    const form = readFileSync(join(process.cwd(), "src/components/forms/service-card-form.tsx"), "utf8");
    const actions = readFileSync(join(process.cwd(), "src/app/(app)/servicos/actions.ts"), "utf8");

    expect(form).toContain("Checklist - Etapas");
    expect(form).toContain("initial_steps_json");
    expect(form).toContain("Adicionar etapa");
    expect(form).toContain("Remover etapa");
    expect(actions).toContain("parseInitialServiceSteps");
    expect(actions).toContain("createServiceChecklistItemRecord");
    expect(actions).toContain("ensureEmptyServiceChecklists");
    expect(actions).toContain("createAgendaReminderForEntity");
    expect(actions).toContain("createDailyTaskForServiceStep");
  });
});
