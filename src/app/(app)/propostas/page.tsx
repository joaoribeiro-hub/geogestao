import { PeriodFilter } from "@/components/filters/period-filter";
import { ProposalKanban } from "@/components/kanban/proposal-kanban";
import { PageHeader } from "@/components/layout/page-header";
import { ProposalV2Create } from "@/components/proposals/proposal-v2-create";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { proposalStages } from "@/lib/constants";
import { filterByPeriod, resolvePeriodRange } from "@/lib/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn, formatCurrency } from "@/lib/utils";
import type { Proposal, ProposalStage } from "@/types/database";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const periodRange = resolvePeriodRange(resolvedSearchParams);
  const supabase = await createServerSupabase();
  const [clientsResult, proposalsResult, attachmentsResult] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("proposals").select("*").order("position"),
    supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", "proposal")
      .order("created_at", { ascending: false }),
  ]);
  const clients = clientsResult.data ?? [];
  const proposals = filterByPeriod(
    proposalsResult.data ?? [],
    periodRange,
    (proposal) => proposal.sent_at ?? proposal.created_at,
  );
  const attachments = attachmentsResult.data ?? [];
  const proposalPdfUrlMap = await buildProposalPdfUrlMap(supabase, attachments);

  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const proposalsWithClients = proposals.map((proposal) => ({
    ...proposal,
    client: clientMap.get(proposal.client_id) ?? null,
    proposalPdfUrl: proposalPdfUrlMap.get(proposal.id) ?? null,
  }));
  const metrics = buildProposalMetrics(proposals);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Propostas comerciais"
          description="Dashboard comercial, criacao por PDF/modelo e Kanban de acompanhamento."
        />
        <ProposalV2Create clients={clients} />
      </div>

      <PeriodFilter range={periodRange} action="/propostas" />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Enviadas" value={metrics.sentCount.toString()} />
        <SummaryCard title="Aprovadas" value={metrics.approvedCount.toString()} />
        <SummaryCard title="Em espera/negociacao" value={metrics.waitingCount.toString()} />
        <SummaryCard title="Nao aprovadas" value={metrics.lostCount.toString()} />
        <SummaryCard title="Valor enviado" value={formatCurrency(metrics.sentAmount)} />
        <SummaryCard title="Valor aprovado" value={formatCurrency(metrics.approvedAmount)} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Status das propostas</CardTitle>
        </CardHeader>
        <CardContent>
          <ProposalStatusChart rows={metrics.chartRows} />
        </CardContent>
      </Card>

      {!clients.length ? (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <EmptyState title="Cadastre um cliente antes de criar propostas." />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6">
        <ProposalKanban proposals={proposalsWithClients} />
      </div>
    </div>
  );
}

async function buildProposalPdfUrlMap(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  attachments: Array<{ entity_id: string; file_path: string; mime_type: string | null }>,
) {
  const pdfAttachments = attachments.filter(
    (attachment) =>
      attachment.mime_type === "application/pdf" || attachment.file_path.endsWith(".pdf"),
  );
  const entries = await Promise.all(
    pdfAttachments.map(async (attachment) => {
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(attachment.file_path, 60 * 60);
      return [attachment.entity_id, data?.signedUrl ?? null] as const;
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
}

function buildProposalMetrics(proposals: Proposal[]) {
  const byStage = proposalStages.reduce<Record<ProposalStage, Proposal[]>>(
    (acc, stage) => {
      acc[stage.id] = proposals.filter((proposal) => proposal.stage === stage.id);
      return acc;
    },
    {
      todo: [],
      sent: [],
      negotiation: [],
      execution: [],
      finished: [],
      lost: [],
    },
  );

  const sum = (rows: Proposal[]) =>
    rows.reduce((total, proposal) => total + Number(proposal.value ?? 0), 0);
  const sentRows = [...byStage.sent, ...byStage.negotiation, ...byStage.execution, ...byStage.finished];
  const approvedRows = [...byStage.execution, ...byStage.finished];
  const maxCount = Math.max(...proposalStages.map((stage) => byStage[stage.id].length), 1);

  return {
    sentCount: byStage.sent.length,
    approvedCount: approvedRows.length,
    waitingCount: byStage.todo.length + byStage.negotiation.length,
    lostCount: byStage.lost.length,
    sentAmount: sum(sentRows),
    approvedAmount: sum(approvedRows),
    chartRows: proposalStages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      count: byStage[stage.id].length,
      amount: sum(byStage[stage.id]),
      percent: (byStage[stage.id].length / maxCount) * 100,
    })),
  };
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-2 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ProposalStatusChart({
  rows,
}: {
  rows: Array<{
    id: ProposalStage;
    title: string;
    count: number;
    amount: number;
    percent: number;
  }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_160px] md:items-center">
          <div>
            <p className="text-sm font-medium">{row.title}</p>
            <p className="text-xs text-muted-foreground">{row.count} proposta(s)</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full bg-primary",
                row.count === 0 && "bg-muted-foreground/30",
              )}
              style={{ width: `${Math.max(row.percent, row.count ? 8 : 2)}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground md:text-right">
            {formatCurrency(row.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}
