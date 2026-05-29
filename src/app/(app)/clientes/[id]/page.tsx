import { notFound } from "next/navigation";
import { ClientInteractionModal } from "@/components/clients/client-interaction-modal";
import { DeleteButton } from "@/components/delete-button";
import { ProfessionalDocumentsPanel } from "@/components/documents/professional-documents-panel";
import { AttachmentActions } from "@/components/files/attachment-actions";
import { AttachmentUploadModal } from "@/components/files/attachment-upload-modal";
import { ClientForm } from "@/components/forms/client-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteClientAction } from "@/app/(app)/clientes/actions";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { formatBrlCurrency, getServiceEstimatedValue } from "@/lib/services/service-finance";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();
  if (!client) notFound();

  const { data: interactionsData } = await supabase
    .from("client_interactions")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("client_id", id)
    .order("occurred_at", { ascending: false });
  const interactions = interactionsData ?? [];

  const { data: attachmentsData } = await supabase
    .from("attachments")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("entity_type", "client")
    .eq("entity_id", client.id)
    .order("created_at", { ascending: false });
  const attachments = attachmentsData ?? [];
  const { data: servicesData } = await supabase
    .from("service_cards")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const services = servicesData ?? [];
  const { data: revenuesData } = services.length
    ? await supabase
        .from("revenues")
        .select("*")
        .eq("organization_id", organization.id)
        .in("service_card_id", services.map((service) => service.id))
    : { data: [] };
  const revenues = revenuesData ?? [];
  const combinedTotal = services.reduce((sum, service) => sum + getServiceEstimatedValue(service), 0);
  const receivedTotal = revenues
    .filter((revenue) => revenue.status === "paid")
    .reduce((sum, revenue) => sum + Number(revenue.amount ?? 0), 0);

  return (
    <div>
      <PageHeader title={client.name} description={client.document ?? "Cliente cadastrado"}>
        <DeleteButton
          confirmMessage="Excluir este cliente? Se houver servicos vinculados ou documentos anexados, a exclusao sera bloqueada ate voce remover esses vinculos."
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
              <CardTitle>Financeiro do cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <FinanceInfo label="Valor combinado total" value={formatBrlCurrency(combinedTotal)} />
                <FinanceInfo label="Valores recebidos" value={formatBrlCurrency(receivedTotal)} />
                <FinanceInfo label="Valores a receber" value={formatBrlCurrency(Math.max(combinedTotal - receivedTotal, 0))} />
                <FinanceInfo label="Servicos vinculados" value={String(services.length)} />
              </div>
              {services.length ? (
                <div className="space-y-2">
                  {services.map((service) => {
                    const serviceReceived = revenues
                      .filter((revenue) => revenue.service_card_id === service.id && revenue.status === "paid")
                      .reduce((sum, revenue) => sum + Number(revenue.amount ?? 0), 0);
                    const serviceValue = getServiceEstimatedValue(service);
                    return (
                      <div key={service.id} className="rounded-md border bg-background p-3 text-sm">
                        <p className="font-medium">{service.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBrlCurrency(serviceValue)} combinado · {formatBrlCurrency(serviceReceived)} recebido · {formatBrlCurrency(Math.max(serviceValue - serviceReceived, 0))} a receber
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="Nenhum servico vinculado ao cliente." />
              )}
            </CardContent>
          </Card>

          <ProfessionalDocumentsPanel
            title="Documentos profissionais do cliente"
            relatedType="client"
            clientId={client.id}
          />

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>Historico</CardTitle>
              <ClientInteractionModal clientId={client.id} />
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

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>Documentos do cliente</CardTitle>
              <AttachmentUploadModal
                label="Documento do cliente"
                entities={[{ id: client.id, type: "client", label: client.name }]}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {attachments.length ? (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.category ?? "Documento"} · {formatDate(attachment.created_at)}
                        </p>
                      </div>
                      <AttachmentActions
                        id={attachment.id}
                        fileName={attachment.file_name}
                        mimeType={attachment.mime_type}
                        category={attachment.category}
                        entityType={attachment.entity_type}
                        entityId={attachment.entity_id}
                        canEdit
                        canDelete
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhum documento anexado." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FinanceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
