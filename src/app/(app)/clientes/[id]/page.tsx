import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/delete-button";
import { ClientForm } from "@/components/forms/client-form";
import { InteractionForm } from "@/components/forms/interaction-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteClientAction } from "@/app/(app)/clientes/actions";
import { formatDate } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!client) notFound();

  const { data: interactionsData } = await supabase
    .from("client_interactions")
    .select("*")
    .eq("client_id", id)
    .order("occurred_at", { ascending: false });
  const interactions = interactionsData ?? [];

  return (
    <div>
      <PageHeader title={client.name} description={client.document ?? "Cliente cadastrado"}>
        <DeleteButton
          confirmMessage="Excluir este cliente? Clientes vinculados a propostas ou financeiro nao poderao ser excluidos."
          action={async () => {
            "use server";
            await deleteClientAction(client.id);
          }}
        />
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Dados cadastrais</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientForm client={client} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nova interacao</CardTitle>
            </CardHeader>
            <CardContent>
              <InteractionForm clientId={client.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historico</CardTitle>
            </CardHeader>
            <CardContent>
              {interactions.length ? (
                <div className="space-y-3">
                  {interactions.map((interaction) => (
                    <div key={interaction.id} className="rounded-lg border bg-background p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{interaction.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(interaction.occurred_at)}
                        </span>
                      </div>
                      <p className="text-sm">{interaction.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhuma interacao registrada." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
