import Link from "next/link";
import { AlertTriangle, CalendarClock, CircleDollarSign, FolderKanban, Users } from "lucide-react";
import { PeriodFilter } from "@/components/filters/period-filter";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { filterByPeriod, resolvePeriodRange } from "@/lib/period";
import { filterOrganizationRows } from "@/lib/services/dashboard-metrics";
import { calculateServiceFinanceSummary } from "@/lib/services/service-finance";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const periodRange = resolvePeriodRange(await searchParams);
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const [
    clientsResult,
    proposalsResult,
    contractsResult,
    cardsResult,
    columnsResult,
    revenuesResult,
    expensesResult,
  ] = await Promise.all([
    supabase.from("clients").select("id,organization_id").eq("organization_id", organization.id),
    supabase.from("proposals").select("*").eq("organization_id", organization.id),
    supabase.from("contracts").select("*").eq("organization_id", organization.id),
    supabase.from("service_cards").select("*").eq("organization_id", organization.id).order("due_date"),
    supabase.from("service_columns").select("*"),
    supabase.from("revenues").select("*").eq("organization_id", organization.id).order("due_date"),
    supabase.from("expenses").select("*").eq("organization_id", organization.id).order("due_date"),
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
      <PageHeader
        title="Dashboard"
        titleTestId="dashboard-title"
        description="Visao rapida de clientes, propostas, servicos em andamento e financeiro."
      />

      <PeriodFilter range={periodRange} action="/" />

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
