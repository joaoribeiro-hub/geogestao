import { ProposalForm } from "@/components/forms/proposal-form";
import { ProposalKanban } from "@/components/kanban/proposal-kanban";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ProposalsPage() {
  const supabase = await createServerSupabase();
  const [clientsResult, proposalsResult] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("proposals").select("*").order("position"),
  ]);
  const clients = clientsResult.data ?? [];
  const proposals = proposalsResult.data ?? [];

  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const proposalsWithClients = proposals.map((proposal) => ({
    ...proposal,
    client: clientMap.get(proposal.client_id) ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Propostas comerciais"
        description="Kanban comercial com persistencia de etapa e conversao direta para servicos tecnicos."
      />

      <div className="grid gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nova proposta</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length ? (
              <ProposalForm clients={clients} />
            ) : (
              <EmptyState title="Cadastre um cliente antes de criar propostas." />
            )}
          </CardContent>
        </Card>

        <ProposalKanban proposals={proposalsWithClients} />
      </div>
    </div>
  );
}
