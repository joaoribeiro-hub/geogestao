import { notFound } from "next/navigation";
import { ClientInteractionModal } from "@/components/clients/client-interaction-modal";
import { DeleteButton } from "@/components/delete-button";
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
