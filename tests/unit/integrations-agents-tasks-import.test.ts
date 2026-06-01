import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapTrelloRowsToServices, normalizeImportText } from "@/lib/services/trello-import";

describe("INTEGRATIONS-AGENTS-TASKS-IMPORT-1", () => {
  it("normaliza textos Trello e mapeia listas para colunas do Kanban", () => {
    const columns = [
      { id: "priority", name: "Prioridade", slug: "prioridade" },
      { id: "done", name: "Concluido", slug: "concluido" },
      { id: "waiting", name: "Aguardando documentos", slug: "aguardando-documentos" },
      { id: "cartorio", name: "Geo Protocolado no Cartorio", slug: "geo-protocolado-cartorio" },
      { id: "confrontante", name: "Geo - Pendencia de Confrontante", slug: "geo-pendencia-confrontante" },
    ];

    expect(normalizeImportText("SERVICO PRIORIDADES")).toBe("servico prioridades");
    const [row] = mapTrelloRowsToServices(
      [
        {
          "Card ID": "trello-1",
          "Card Name": "Fazenda Boa Vista",
          "Card URL": "https://trello.com/c/abc",
          "Card Description": "Descricao original",
          Labels: "PRIORIDADE, CARTA DE CONFRONTACAO",
          "List Name": "SERVICO PRIORIDADES",
          "Due Date": "2026-06-10",
          "Start Date": "2026-06-01",
        },
      ],
      columns,
    );

    expect(row.columnId).toBe("priority");
    expect(row.priority).toBe("high");
    expect(row.dueDate).toBe("2026-06-10");
    expect(row.externalId).toBe("trello-1");
    expect(row.description).toContain("Descricao original");
  });

  it("mapeia planilha customizada pela coluna Card", () => {
    const columns = [
      { id: "waiting", name: "Aguardando documentos", slug: "aguardando-documentos" },
      { id: "andamento", name: "Geo em Andamento", slug: "geo-em-andamento" },
      { id: "cartorio", name: "Geo Protocolado no Cartorio", slug: "geo-protocolado-cartorio" },
      { id: "incra", name: "Geo Protocolado no INCRA", slug: "geo-protocolado-incra" },
      { id: "confrontante", name: "Geo - Pendencia de Confrontante", slug: "geo-pendencia-confrontante" },
      { id: "old", name: "Antigos a concluir", slug: "antigos-a-concluir" },
      { id: "done", name: "Geo Concluido", slug: "geo-concluido" },
    ];

    const rows = mapTrelloRowsToServices(
      [
        {
          "Card Name": "Fazenda Carta",
          "Descrição": "Observacao da planilha",
          Card: "CARTA DE CONFRONTAÇÃO (orange), EM ANDAMENTO (lime_dark)",
        },
        {
          "Card Name": "Fazenda Cartorio",
          "Descrição": "Protocolado",
          Card: "EM ANDAMENTO (lime_dark), PROTOCOLO CARTÓRIO (yellow), URGENTE (red_dark)",
        },
      ],
      columns,
    );

    expect(rows[0].columnId).toBe("confrontante");
    expect(rows[0].description).toContain("Observacao da planilha");
    expect(rows[0].sourceLabels).toContain("CARTA");
    expect(rows[1].columnId).toBe("cartorio");
    expect(rows[1].priority).toBe("urgent");
  });

  it("mapeia Antigos a concluir quando a planilha informa esse status", () => {
    const rows = mapTrelloRowsToServices(
      [
        {
          "Card Name": "Fazenda Antiga",
          Card: "ANTIGOS A CONCLUIR",
        },
      ],
      [
        { id: "waiting", name: "Aguardando documentos", slug: "aguardando-documentos" },
        { id: "old", name: "Antigos a concluir", slug: "antigos-a-concluir" },
      ],
    );

    expect(rows[0].columnId).toBe("old");
  });

  it("mapeia colunas especificas do fluxo CAR pela coluna Card", () => {
    const columns = [
      { id: "waiting", name: "Aguardando documentos", slug: "aguardando-documentos" },
      { id: "retification", name: "CAR em Retificacao", slug: "car-em-retificacao" },
      { id: "progress", name: "CAR em Andamento", slug: "car-em-andamento" },
      { id: "priority", name: "Prioridade", slug: "prioridade" },
      { id: "overdue", name: "Em atraso", slug: "em-atraso" },
      { id: "sync", name: "Aguardando Sincronizacao", slug: "aguardando-sincronizacao" },
      { id: "old", name: "Antigos a concluir", slug: "antigos-a-concluir" },
      { id: "done", name: "CAR Concluido", slug: "car-concluido" },
    ];

    const rows = mapTrelloRowsToServices(
      [
        { "Card Name": "CAR Retificar", Card: "CAR EM RETIFICACAO" },
        { "Card Name": "CAR Sincronizar", Card: "AGUARDANDO SINCRONIZACAO" },
        { "Card Name": "CAR Protocolo", Card: "PROTOCOLO INCRA" },
        { "Card Name": "CAR Concluido", Card: "CONCLUIDO" },
        { "Card Name": "CAR Urgente", Card: "EM ANDAMENTO, URGENTE" },
      ],
      columns,
    );

    expect(rows[0].columnId).toBe("retification");
    expect(rows[1].columnId).toBe("sync");
    expect(rows[2].columnId).toBe("sync");
    expect(rows[3].columnId).toBe("done");
    expect(rows[4].columnId).toBe("progress");
    expect(rows[4].priority).toBe("urgent");
  });

  it("migration cria integracoes, agentes, sync de calendario e importacao", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/037_integrations_agents_tasks_import.sql"),
      "utf8",
    );

    expect(sql).toContain("create table if not exists public.user_integrations");
    expect(sql).toContain("access_token_encrypted");
    expect(sql).toContain("refresh_token_encrypted");
    expect(sql).toContain("calendar_event_syncs");
    expect(sql).toContain("ai_agents");
    expect(sql).toContain("ai_agent_runs");
    expect(sql).toContain("service_import_batches");
    expect(sql).toContain("service_cards_org_import_source_external_idx");
    expect(sql).toContain("briefing-matinal");
  });

  it("documentos suportam Google Drive sem expor token no painel", () => {
    const panel = readFileSync(
      join(process.cwd(), "src/components/documents/professional-documents-panel.tsx"),
      "utf8",
    );

    expect(panel).toContain("Meu Google Drive");
    expect(panel).toContain("/api/integrations/google/drive/upload");
    expect(panel).toContain("google_drive_owner_email");
    expect(panel).not.toContain("refresh_token");
  });

  it("Sophia substitui a identidade visual do assistente sem remover rota antiga", () => {
    const floating = readFileSync(
      join(process.cwd(), "src/components/assistant/assistant-floating-widget.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(process.cwd(), "src/app/(app)/assistente-ia/page.tsx"),
      "utf8",
    );

    expect(floating).toContain("Sou a Sophia");
    expect(floating).toContain("Abrir Sophia");
    expect(page).toContain('title="Sophia"');
  });

  it("widget Tarefa preserva checklist e adiciona aba Lembrete", () => {
    const widget = readFileSync(
      join(process.cwd(), "src/components/checklist/daily-checklist-widget.tsx"),
      "utf8",
    );

    expect(widget).toContain("Tarefa");
    expect(widget).toContain("Lembrete");
    expect(widget).toContain("/api/daily-checklist");
    expect(widget).toContain("/api/reminders/quick");
    expect(widget).toContain("Notifique");
  });

  it("Inicio mostra indicadores apenas para owner", () => {
    const home = readFileSync(join(process.cwd(), "src/app/(app)/page.tsx"), "utf8");
    expect(home).toContain("const isOwner = context.membership.role === \"owner\"");
    expect(home).toContain("{isOwner ? (");
    expect(home).toContain("Total de clientes");
  });
});
