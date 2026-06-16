import Link from "next/link";
import { AlertTriangle, Bell, CalendarClock, CircleDollarSign, FolderKanban, Search, Users } from "lucide-react";
import { PeriodFilter } from "@/components/filters/period-filter";
import { HomeAgentCards, type HomeAgentCardData } from "@/components/home/home-agent-cards";
import { HomeNotifications } from "@/components/home/home-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getBrazilGreeting } from "@/lib/home/greeting";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { filterByPeriod, resolvePeriodRange } from "@/lib/period";
import { filterOrganizationRows } from "@/lib/services/dashboard-metrics";
import { calculateServiceFinanceSummary } from "@/lib/services/service-finance";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DailyChecklistItem } from "@/types/database";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodRange = resolvePeriodRange(params);
  const q = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) {
    throw new Error("Usuario sem organizacao vinculada.");
  }
  const organization = context.organization;
  const isOwner = context.membership.role === "owner";
  const today = new Date().toISOString().slice(0, 10);
  const [
    clientsResult,
    proposalsResult,
    contractsResult,
    cardsResult,
    columnsResult,
    revenuesResult,
    expensesResult,
    profileResult,
    checklistResult,
    agentsResult,
    agentRunsResult,
  ] = await Promise.all([
    supabase.from("clients").select("id,organization_id,name").eq("organization_id", organization.id),
    supabase.from("proposals").select("*").eq("organization_id", organization.id),
    supabase.from("contracts").select("*").eq("organization_id", organization.id),
    supabase.from("service_cards").select("*").eq("organization_id", organization.id).order("due_date"),
    supabase.from("service_columns").select("*"),
    supabase.from("revenues").select("*").eq("organization_id", organization.id).order("due_date"),
    supabase.from("expenses").select("*").eq("organization_id", organization.id).order("due_date"),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("daily_checklist_items")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("assigned_to", user.id)
      .in("status", ["open", "done"])
      .is("deleted_at", null)
      .is("archived_at", null)
      .or(`due_date.lte.${today},due_date.is.null`)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_agents")
      .select("id,slug,name")
      .in("slug", ["briefing-matinal", "revisao-semanal"])
      .eq("is_active", true),
    supabase
      .from("ai_agent_runs")
      .select("agent_id,summary,status,created_at,output")
      .eq("organization_id", organization.id)
      .eq("triggered_by", user.id)
      .in("status", ["completed", "error"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const clients = filterOrganizationRows(clientsResult.data ?? [], organization.id);
  const proposals = filterByPeriod(
    filterOrganizationRows(proposalsResult.data ?? [], organization.id),
    periodRange,
    (proposal) => proposal.sent_at ?? proposal.created_at,
  );
  const contracts = filterByPeriod(
    filterOrganizationRows(contractsResult.data ?? [], organization.id),
    periodRange,
    (contract) => contract.sent_at ?? contract.signed_at ?? contract.created_at,
  );
  const cards = filterByPeriod(
    filterOrganizationRows(cardsResult.data ?? [], organization.id),
    periodRange,
    (card) => card.due_date ?? card.created_at,
  );
  const columns = columnsResult.data ?? [];
  const revenues = filterByPeriod(
    filterOrganizationRows(revenuesResult.data ?? [], organization.id),
    periodRange,
    (revenue) => revenue.due_date ?? revenue.created_at,
  );
  const expenses = filterByPeriod(
    filterOrganizationRows(expensesResult.data ?? [], organization.id),
    periodRange,
    (expense) => expense.due_date ?? expense.created_at,
  );

  const columnMap = new Map(columns.map((column) => [column.id, column]));
  const inProgressCards = cards.filter((card) => {
    const column = columnMap.get(card.column_id);
    return !column?.slug.includes("concluido");
  });
  const pendingRevenues = revenues.filter((item) => item.status !== "paid");
  const sentProposals = proposals.filter((proposal) =>
    ["sent", "negotiation", "execution", "finished"].includes(proposal.stage),
  );
  const approvedProposals = proposals.filter((proposal) =>
    ["execution", "finished"].includes(proposal.stage),
  );
  const negotiationProposals = proposals.filter((proposal) => proposal.stage === "negotiation");
  const lostProposals = proposals.filter((proposal) => proposal.stage === "lost");
  const activeContracts = contracts.filter((contract) =>
    ["assinado", "em_execucao", "finalizado"].includes(contract.status),
  );
  const pendingContracts = contracts.filter(
    (contract) => !["assinado", "em_execucao", "finalizado", "cancelado"].includes(contract.status),
  );
  const receivedRevenues = revenues.filter((item) => item.status === "paid");
  const lostProposalAmount = lostProposals.reduce(
    (sum, proposal) => sum + Number(proposal.value ?? 0),
    0,
  );

  const receivedRevenueAmount = receivedRevenues.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const expenseAmount = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const serviceFinance = calculateServiceFinanceSummary(cards, columnMap);
  const greeting = getBrazilGreeting();
  const displayName = profileResult.data?.full_name ?? user.email ?? "usuario";
  const todayTasks = ((checklistResult.data ?? []) as DailyChecklistItem[]).filter((item) => {
    if (item.status === "open") return !item.due_date || item.due_date <= today;
    return item.completed_at?.slice(0, 10) === today || item.due_date === today;
  });
  const agentBySlug = new Map((agentsResult.data ?? []).map((agent) => [agent.slug, agent]));
  const latestRunFor = (slug: HomeAgentCardData["slug"]) => {
    const agent = agentBySlug.get(slug);
    return (agentRunsResult.data ?? []).find((run) => run.agent_id === agent?.id) ?? null;
  };
  const homeAgentCards: HomeAgentCardData[] = [
    {
      slug: "briefing-matinal",
      title: agentBySlug.get("briefing-matinal")?.name ?? "Briefing da manha",
      helperText: "Quer ajuda para saber o que tem para hoje? Aperte o botao.",
      summary: latestRunFor("briefing-matinal")?.summary ?? null,
      status: latestRunFor("briefing-matinal")?.status ?? null,
      createdAt: latestRunFor("briefing-matinal")?.created_at ?? null,
    },
    {
      slug: "revisao-semanal",
      title: agentBySlug.get("revisao-semanal")?.name ?? "Revisao semanal",
      helperText: "Quer revisar sua semana e ver pendencias? Aperte o botao.",
      summary: latestRunFor("revisao-semanal")?.summary ?? null,
      status: latestRunFor("revisao-semanal")?.status ?? null,
      createdAt: latestRunFor("revisao-semanal")?.created_at ?? null,
    },
  ];
  const normalizedQuery = q.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? [
        ...clients
          .filter((client) => client.name?.toLowerCase().includes(normalizedQuery))
          .slice(0, 5)
          .map((client) => ({ href: `/clientes/${client.id}`, label: client.name ?? "Cliente", type: "Cliente" })),
        ...cards
          .filter((card) => card.title.toLowerCase().includes(normalizedQuery))
          .slice(0, 5)
          .map((card) => ({ href: `/servicos/${card.id}`, label: card.title, type: "Servico" })),
        ...[
          { href: "/servicos", label: "Servicos", type: "Menu" },
          { href: "/clientes", label: "Clientes", type: "Menu" },
          { href: "/agenda", label: "Agenda", type: "Menu" },
          { href: "/rotina", label: "Rotina", type: "Menu" },
          { href: "/financeiro", label: "Financeiro", type: "Menu" },
        ].filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      ]
    : [];

  if (process.env.NODE_ENV !== "production") {
    console.info("[dashboard:organization-scope]", {
      userId: user.id,
      organizationId: organization.id,
      clients: clients.length,
      proposals: proposals.length,
      contracts: contracts.length,
      serviceCards: cards.length,
      revenues: revenues.length,
      expenses: expenses.length,
    });
  }

  const nextDue = [
    ...revenues
      .filter((item) => item.status !== "paid")
      .map((item) => ({ id: item.id, type: "Receita", title: item.description, date: item.due_date })),
    ...expenses
      .filter((item) => item.status !== "paid")
      .map((item) => ({ id: item.id, type: "Despesa", title: item.description, date: item.due_date })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const overdueCards = inProgressCards.filter((card) => {
    if (!card.due_date) return false;
    return new Date(card.due_date) < new Date(new Date().toISOString().slice(0, 10));
  });

  return (
    <div data-testid="dashboard-page">
      <section className="mb-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {formatDate(new Date().toISOString().slice(0, 10))}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal" data-testid="dashboard-title">
          {greeting}, {displayName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Central operacional do GeoGestao.</p>
      </section>

      <Card className="mx-auto mb-6 max-w-4xl">
        <CardContent className="p-5">
          <form action="/" className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Pesquisar tarefas, servicos, clientes, menus ou perguntar ao assistente..."
                className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <Button>Buscar</Button>
          </form>
          {normalizedQuery ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {searchResults.length ? (
                searchResults.map((item) => (
                  <Link key={`${item.type}-${item.href}`} href={item.href} className="rounded-md bg-secondary px-3 py-2 text-sm hover:bg-secondary/80">
                    <Badge variant="outline" className="mr-2">{item.type}</Badge>
                    {item.label}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nao encontrei registro direto. Use a Sophia flutuante para interpretar como pergunta ou comando.
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PeriodFilter range={periodRange} action="/" compact />

      <HomeAgentCards cards={homeAgentCards} />

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Tarefas de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.length ? (
              <div className="space-y-2">
                {todayTasks.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                    <p className={item.status === "done" ? "text-muted-foreground line-through" : "font-medium"}>{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.is_emergency ? "Emergencia · " : ""}{item.status === "done" ? "Concluida" : "Aberta"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhuma tarefa programada para hoje." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5" aria-hidden="true" />
              Notificacoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HomeNotifications />
          </CardContent>
        </Card>
      </div>

      {isOwner ? (
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Total de clientes" value={clients.length.toString()} icon={<Users />} />
        <Metric title="Propostas enviadas" value={sentProposals.length.toString()} icon={<FolderKanban />} />
        <Metric title="Propostas aprovadas" value={approvedProposals.length.toString()} icon={<FolderKanban />} />
        <Metric title="Propostas em negociacao" value={negotiationProposals.length.toString()} icon={<FolderKanban />} />
        <Metric title="Propostas perdidas" value={lostProposals.length.toString()} icon={<AlertTriangle />} />
        <Metric title="Valor total enviado" value={formatCurrency(sentProposals.reduce((sum, item) => sum + Number(item.value ?? 0), 0))} icon={<CircleDollarSign />} />
        <Metric title="Valor total aprovado" value={formatCurrency(approvedProposals.reduce((sum, item) => sum + Number(item.value ?? 0), 0))} icon={<CircleDollarSign />} />
        <Metric title="Valor perdido" value={formatCurrency(lostProposalAmount)} icon={<CircleDollarSign />} />
        <Metric title="Contratos ativos" value={activeContracts.length.toString()} icon={<FolderKanban />} />
        <Metric title="Contratos pendentes" value={pendingContracts.length.toString()} icon={<FolderKanban />} />
        <Metric title="Receitas recebidas" value={formatCurrency(receivedRevenueAmount)} icon={<CircleDollarSign />} />
        <Metric title="Receitas a receber" value={formatCurrency(pendingRevenues.reduce((sum, item) => sum + Number(item.amount), 0))} icon={<CircleDollarSign />} />
        <Metric title="Despesas" value={formatCurrency(expenseAmount)} icon={<CircleDollarSign />} />
        <Metric title="Lucro estimado" value={formatCurrency(serviceFinance.estimatedProfit)} icon={<CircleDollarSign />} />
        <Metric title="Projetos em andamento" value={inProgressCards.length.toString()} icon={<CalendarClock />} />
        <Metric title="Projetos atrasados" value={overdueCards.length.toString()} icon={<AlertTriangle />} />
      </div>
      ) : null}

      {isOwner ? (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proximos vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {nextDue.length ? (
              <div className="space-y-3">
                {nextDue.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center justify-between rounded-lg border bg-background p-4">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <Badge className="mt-2" variant="secondary">{item.type}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatDate(item.date)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum vencimento pendente." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projetos atrasados</CardTitle>
          </CardHeader>
          <CardContent>
            {overdueCards.length ? (
              <div className="space-y-3">
                {overdueCards.map((card) => (
                  <Link
                    key={card.id}
                    href={`/servicos/${card.id}`}
                    className="block rounded-lg border bg-background p-4 hover:border-primary"
                  >
                    <p className="font-medium">{card.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Previsto para {formatDate(card.due_date)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum projeto atrasado." />
            )}
          </CardContent>
        </Card>
      </div>
      ) : null}
    </div>
  );
}

function Metric({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-primary/10 p-2 text-primary [&_svg]:size-5">{icon}</div>
      </CardContent>
    </Card>
  );
}
