import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAgentOutput } from "@/lib/ai-agents/runner";

describe("AGENTS-TASKS-SYNC-FIX-1", () => {
  it("Briefing gera um objeto JSON final mesmo sem tarefas", () => {
    const output = buildAgentOutput({
      context: {
        slug: "briefing-matinal",
        tasks: [],
        reminders: [],
        services: [],
        documents: [],
        workTime: [],
        finance: [],
      },
      summary: "Nada urgente para hoje.",
      generatedAt: "2026-05-30T08:00:00.000Z",
    });

    expect(output).toMatchObject({
      summary: "Nada urgente para hoje.",
      priorities: [],
      tasks: [],
      deadlines: [],
      warnings: [],
      nextActions: ["Nenhuma tarefa, prazo ou pendencia encontrada para hoje."],
      reminders: [],
      services: [],
      generatedAt: "2026-05-30T08:00:00.000Z",
    });
    expect(output.sections[0].items).toContain("Nada urgente para hoje.");
  });

  it("saida do agente continua objeto valido com tarefas abertas", () => {
    const output = buildAgentOutput({
      context: {
        slug: "briefing-matinal",
        tasks: [{ id: "task-1", title: "Ligar no cartorio", is_emergency: true }],
        reminders: [],
        services: [],
        documents: [],
        workTime: [],
        finance: [],
      },
      summary: "Ha tarefas abertas.",
      generatedAt: "2026-05-30T08:00:00.000Z",
    });

    expect(output.summary).toBe("Ha tarefas abertas.");
    expect(output.priorities).toContain("Ligar no cartorio");
    expect(output.tasks).toHaveLength(1);
    expect(output.nextActions[0]).toContain("Ligar no cartorio");
  });

  it("runner dos agentes nao usa single frágil no insert/update do run", () => {
    const runner = readFileSync(join(process.cwd(), "src/lib/ai-agents/runner.ts"), "utf8");

    expect(runner).toContain(".limit(1)");
    expect(runner).not.toContain(".select(\"*\")\n    .single()");
    expect(runner).toContain("Agente financeiro disponivel apenas para owner");
  });

  it("Google OAuth sem env mostra mensagem amigavel na interface", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/integrations/google/connect/route.ts"),
      "utf8",
    );
    const panel = readFileSync(
      join(process.cwd(), "src/components/account/google-integrations-panel.tsx"),
      "utf8",
    );

    expect(route).toContain("google\", \"not_configured\"");
    expect(panel).toContain("Google ainda nao foi configurado no servidor");
    expect(panel).not.toContain("GOOGLE_CLIENT_SECRET=");
  });

  it("Tarefa e Rotina ficam ligadas pela rotina diaria e carry-over", () => {
    const dailyRoute = readFileSync(join(process.cwd(), "src/app/api/daily-checklist/route.ts"), "utf8");
    const itemRoute = readFileSync(
      join(process.cwd(), "src/app/api/daily-checklist/[itemId]/route.ts"),
      "utf8",
    );
    const serviceActions = readFileSync(join(process.cwd(), "src/app/(app)/servicos/actions.ts"), "utf8");
    const routinePage = readFileSync(join(process.cwd(), "src/app/(app)/rotina/page.tsx"), "utf8");
    const widget = readFileSync(
      join(process.cwd(), "src/components/checklist/daily-checklist-widget.tsx"),
      "utf8",
    );

    expect(dailyRoute).toContain(".from(\"routine_items\")");
    expect(dailyRoute).toContain("daily_checklist_item_id: item.id");
    expect(dailyRoute).toContain("due_date.lte");
    expect(itemRoute).toContain("routine_date: parsed.data.dueDate");
    expect(itemRoute).toContain("export async function DELETE");
    expect(serviceActions).toContain("createDailyTaskForServiceStep");
    expect(routinePage).toContain("item.status === \"open\"");
    expect(routinePage).toContain("item.routine_date <= day");
    expect(widget).toContain("Editar item");
    expect(widget).toContain("Apagar item");
  });

  it("Inicio usa filtro recolhido e cards dos agentes", () => {
    const periodFilter = readFileSync(join(process.cwd(), "src/components/filters/period-filter.tsx"), "utf8");
    const home = readFileSync(join(process.cwd(), "src/app/(app)/page.tsx"), "utf8");
    const cards = readFileSync(join(process.cwd(), "src/components/home/home-agent-cards.tsx"), "utf8");

    expect(periodFilter).toContain("compact = false");
    expect(periodFilter).toContain("Filtro");
    expect(home).toContain("<PeriodFilter range={periodRange} action=\"/\" compact />");
    expect(home).toContain("<HomeAgentCards cards={homeAgentCards} />");
    expect(home).toContain("Briefing da manha");
    expect(home).toContain("Quer ajuda para saber o que tem para hoje? Aperte o botao.");
    expect(home).toContain("Quer revisar sua semana e ver pendencias? Aperte o botao.");
    expect(cards).toContain("Atualizar agora");
  });

  it("Servicos, Propostas e Contratos iniciam em Tudo com filtro recolhido", () => {
    const services = readFileSync(join(process.cwd(), "src/app/(app)/servicos/page.tsx"), "utf8");
    const proposals = readFileSync(join(process.cwd(), "src/app/(app)/propostas/page.tsx"), "utf8");
    const contracts = readFileSync(join(process.cwd(), "src/app/(app)/contratos/page.tsx"), "utf8");

    expect(services).toContain("resolvePeriodRange(params, new Date(), \"all\")");
    expect(services).toContain("compact");
    expect(proposals).toContain("resolvePeriodRange(resolvedSearchParams, new Date(), \"all\")");
    expect(proposals).toContain("action=\"/propostas\" compact");
    expect(contracts).toContain("resolvePeriodRange(await searchParams, new Date(), \"all\")");
    expect(contracts).toContain("action=\"/contratos\" compact");
  });

  it("cron dos agentes é protegido e agendado para 08:00 UTC", () => {
    const cronRoute = readFileSync(
      join(process.cwd(), "src/app/api/cron/agents/daily-briefing/route.ts"),
      "utf8",
    );
    const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    expect(cronRoute).toContain("CRON_SECRET");
    expect(cronRoute).toContain("briefing-matinal");
    expect(cronRoute).toContain("revisao-semanal");
    expect(vercel).toContain("\"schedule\": \"0 8 * * *\"");
    expect(env).toContain("CRON_SECRET=");
  });

  it("checklists do servico possuem modal de adicionar, editar e rolagem de Kanban", () => {
    const forms = readFileSync(join(process.cwd(), "src/components/forms/checklist-forms.tsx"), "utf8");
    const servicePage = readFileSync(join(process.cwd(), "src/app/(app)/servicos/[id]/page.tsx"), "utf8");
    const kanban = readFileSync(join(process.cwd(), "src/components/kanban/service-kanban.tsx"), "utf8");
    const assistantActions = readFileSync(join(process.cwd(), "src/lib/assistant/actions.ts"), "utf8");
    const detector = readFileSync(join(process.cwd(), "src/lib/assistant/intent-detector.ts"), "utf8");

    expect(forms).toContain("ModalDisclosure");
    expect(forms).toContain("+ Adicionar item");
    expect(forms).toContain("Editar item");
    expect(forms).toContain("updateChecklistItemAction");
    expect(servicePage).toContain("serviceCardId={card.id}");
    expect(kanban).toContain("service-column-scroll");
    expect(kanban).toContain("overflow-y-auto");
    expect(assistantActions).toContain("completeServiceStep");
    expect(detector).toContain("complete_service_step");
  });
});
