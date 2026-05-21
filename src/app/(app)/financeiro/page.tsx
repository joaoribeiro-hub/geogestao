import { PeriodFilter } from "@/components/filters/period-filter";
import { FinanceEntryModals } from "@/components/finance/finance-entry-modals";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { filterByPeriod, resolvePeriodRange } from "@/lib/period";
import {
  calculateServiceFinanceSummary,
  isServiceLostColumn,
} from "@/lib/services/service-finance";
import { filterServiceCardsByOperationalPeriod } from "@/lib/services/service-period";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense, FinanceStatus, Revenue, ServiceCard } from "@/types/database";

const statusLabel: Record<FinanceStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
};

export default async function FinancePage({
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
    serviceCardsResult,
    serviceColumnsResult,
    revenuesResult,
    expensesResult,
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("organization_id", organization.id).order("name"),
    supabase
      .from("proposals")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_cards")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    supabase.from("service_columns").select("*"),
    supabase.from("revenues").select("*").eq("organization_id", organization.id).order("due_date"),
    supabase.from("expenses").select("*").eq("organization_id", organization.id).order("due_date"),
  ]);
  const clients = clientsResult.data ?? [];
  const proposals = proposalsResult.data ?? [];
  const serviceCards = serviceCardsResult.data ?? [];
  const serviceColumns = serviceColumnsResult.data ?? [];
  const serviceColumnById = new Map(
    serviceColumns.map((column) => [column.id, column]),
  );
  const serviceCardsInPeriod = filterServiceCardsByOperationalPeriod(
    serviceCards,
    serviceColumnById,
    periodRange,
  );
  const lostServiceIds = new Set(
    serviceCards
      .filter((card) => isServiceLostColumn(serviceColumnById.get(card.column_id)))
      .map((card) => card.id),
  );
  const revenues = filterByPeriod(
    revenuesResult.data ?? [],
    periodRange,
    (revenue) => revenue.due_date ?? revenue.created_at,
  ).filter(
    (revenue) =>
      !(revenue.auto_generated && revenue.service_card_id && lostServiceIds.has(revenue.service_card_id)),
  );
  const expenses = filterByPeriod(
    expensesResult.data ?? [],
    periodRange,
    (expense) => expense.due_date ?? expense.created_at,
  );

  const serviceFinance = calculateServiceFinanceSummary(
    serviceCardsInPeriod,
    serviceColumnById,
  );
  const monthlyRevenue = revenues
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const monthlyExpense = expenses
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const projectRows = serviceCardsInPeriod
    .map((card) => {
      const projectRevenues = revenues
        .filter((item) => item.service_card_id === card.id)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const projectExpenses = expenses
        .filter((item) => item.service_card_id === card.id)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return {
        id: card.id,
        title: card.title,
        revenues: projectRevenues,
        expenses: projectExpenses,
        profit: projectRevenues - projectExpenses,
      };
    })
    .filter((item) => item.revenues > 0 || item.expenses > 0);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas, contas pendentes e resumo de resultado por mes e projeto."
      />

      <PeriodFilter range={periodRange} action="/financeiro" />
      <FinanceEntryModals
        clients={clients}
        proposals={proposals}
        serviceCards={serviceCards}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard title="Receitas do periodo" value={formatCurrency(monthlyRevenue)} />
        <SummaryCard title="Despesas do periodo" value={formatCurrency(monthlyExpense)} />
        <SummaryCard title="Lucro estimado" value={formatCurrency(serviceFinance.estimatedProfit)} />
        <SummaryCard title="Lucro efetuado" value={formatCurrency(serviceFinance.realizedProfit)} />
        <SummaryCard title="Lucro perdido" value={formatCurrency(serviceFinance.lostProfit)} />
        <SummaryCard title="Resultado do periodo" value={formatCurrency(serviceFinance.realizedProfit - monthlyExpense)} />
      </div>

      <ProjectProfitSummary rows={projectRows} />

      <div className="grid gap-6 xl:grid-cols-2">
        <FinanceTable title="Contas a receber" rows={revenues} kind="revenue" serviceCards={serviceCards} />
        <FinanceTable title="Contas a pagar" rows={expenses} kind="expense" serviceCards={serviceCards} />
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ProjectProfitSummary({
  rows,
}: {
  rows: Array<{
    id: string;
    title: string;
    revenues: number;
    expenses: number;
    profit: number;
  }>;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Resumo por projeto</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Projeto</th>
                  <th className="px-4 py-3 font-medium">Receitas</th>
                  <th className="px-4 py-3 font-medium">Despesas</th>
                  <th className="px-4 py-3 font-medium">Lucro estimado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t bg-card">
                    <td className="px-4 py-3 font-medium">{row.title}</td>
                    <td className="px-4 py-3">{formatCurrency(row.revenues)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.expenses)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum projeto com financeiro vinculado." />
        )}
      </CardContent>
    </Card>
  );
}

function FinanceTable({
  title,
  rows,
  kind,
  serviceCards,
}: {
  title: string;
  rows: Revenue[] | Expense[];
  kind: "revenue" | "expense";
  serviceCards: ServiceCard[];
}) {
  const projectSummary = serviceCards.map((card) => {
    const related = rows.filter((row) => row.service_card_id === card.id);
    return {
      title: card.title,
      total: related.reduce((sum, row) => sum + Number(row.amount), 0),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent data-testid={kind === "revenue" ? "finance-revenues" : "finance-expenses"}>
        {rows.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Descricao</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t bg-card">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.description}</p>
                      <p className="text-xs text-muted-foreground">{row.category}</p>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(Number(row.amount))}</td>
                    <td className="px-4 py-3">{formatDate(row.due_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.status === "overdue" ? "destructive" : "secondary"}>
                        {statusLabel[row.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={kind === "revenue" ? "Nenhuma receita." : "Nenhuma despesa."} />
        )}

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">Resumo por projeto</h3>
          <div className="space-y-2">
            {projectSummary
              .filter((item) => item.total > 0)
              .map((item) => (
                <div key={item.title} className="flex justify-between rounded-md bg-secondary px-3 py-2 text-sm">
                  <span>{item.title}</span>
                  <span className="font-medium">{formatCurrency(item.total)}</span>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
