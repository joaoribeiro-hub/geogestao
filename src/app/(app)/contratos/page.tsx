import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ContractStatus } from "@/types/database";

const statusLabels: Record<ContractStatus, string> = {
  contrato_a_gerar: "Contrato a gerar",
  contrato_gerado: "Contrato gerado",
  enviado_para_assinatura: "Enviado para assinatura",
  assinado: "Assinado",
  em_execucao: "Em execucao",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export default async function ContractsPage() {
  const supabase = await createServerSupabase();
  const [contractsResult, clientsResult, proposalsResult, serviceCardsResult] =
    await Promise.all([
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("proposals").select("id,title").order("title"),
      supabase.from("service_cards").select("id,title").order("title"),
    ]);

  const contracts = contractsResult.data ?? [];
  const clients = clientsResult.data ?? [];
  const proposals = proposalsResult.data ?? [];
  const serviceCards = serviceCardsResult.data ?? [];
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const proposalMap = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const serviceCardMap = new Map(serviceCards.map((card) => [card.id, card]));

  return (
    <div>
      <PageHeader
        title="Contratos"
        description="Contratos vinculados a clientes, propostas, servicos e receitas previstas."
      />

      <Card>
        <CardHeader>
          <CardTitle>Contratos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {contractsResult.error ? (
            <EmptyState
              title="Nao foi possivel carregar contratos. Verifique se a migration da Fase 1 foi aplicada no Supabase real."
            />
          ) : contracts.length ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Contrato</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Servico</th>
                    <th className="px-4 py-3 font-medium">Datas</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract) => {
                    const proposal = contract.proposal_id
                      ? proposalMap.get(contract.proposal_id)
                      : null;
                    const serviceCard = contract.service_card_id
                      ? serviceCardMap.get(contract.service_card_id)
                      : null;

                    return (
                      <tr key={contract.id} className="border-t bg-card align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">{contract.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                          {proposal ? `Proposta: ${proposal.title}` : "Sem proposta vinculada"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {clientMap.get(contract.client_id)?.name ?? "-"}
                        </td>
                        <td className="px-4 py-3">{formatCurrency(contract.amount)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={contract.status === "cancelado" ? "destructive" : "secondary"}>
                            {statusLabels[contract.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {serviceCard ? (
                            <Link
                              href={`/servicos/${serviceCard.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {serviceCard.title}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Sem servico vinculado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <p>Criado: {formatDate(contract.created_at)}</p>
                          <p>Envio: {formatDate(contract.sent_at)}</p>
                          <p>Assinatura: {formatDate(contract.signed_at)}</p>
                          <p>Inicio: {formatDate(contract.starts_at)}</p>
                          <p>Fim: {formatDate(contract.ends_at)}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nenhum contrato cadastrado. Converta uma proposta para gerar o primeiro contrato." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
