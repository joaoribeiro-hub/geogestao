import { AttachmentUploader, type AttachmentEntityOption } from "@/components/forms/attachment-uploader";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function AttachmentsPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const [
    clientsResult,
    proposalsResult,
    serviceCardsResult,
    contractsResult,
    revenuesResult,
    expensesResult,
    documentsResult,
    legislationResult,
    attachmentsResult,
  ] = await Promise.all([
    supabase.from("clients").select("id,name").eq("organization_id", organization.id).order("name"),
    supabase.from("proposals").select("id,title").eq("organization_id", organization.id).order("title"),
    supabase.from("service_cards").select("id,title").eq("organization_id", organization.id).order("title"),
    supabase.from("contracts").select("id,title").eq("organization_id", organization.id).order("title"),
    supabase.from("revenues").select("id,description").eq("organization_id", organization.id).order("description"),
    supabase.from("expenses").select("id,description").eq("organization_id", organization.id).order("description"),
    supabase.from("document_templates").select("id,title").eq("organization_id", organization.id).order("title"),
    supabase.from("legislation_items").select("id,title").eq("organization_id", organization.id).order("title"),
    supabase.from("attachments").select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }),
  ]);
  const clients = clientsResult.data ?? [];
  const proposals = proposalsResult.data ?? [];
  const serviceCards = serviceCardsResult.data ?? [];
  const contracts = contractsResult.data ?? [];
  const revenues = revenuesResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const legislation = legislationResult.data ?? [];
  const attachments = attachmentsResult.data ?? [];

  const entities: AttachmentEntityOption[] = [
    ...clients.map((item) => ({ id: item.id, type: "client" as const, label: item.name })),
    ...proposals.map((item) => ({ id: item.id, type: "proposal" as const, label: item.title })),
    ...serviceCards.map((item) => ({ id: item.id, type: "service_card" as const, label: item.title })),
    ...contracts.map((item) => ({ id: item.id, type: "contract" as const, label: item.title })),
    ...revenues.map((item) => ({ id: item.id, type: "revenue" as const, label: item.description })),
    ...expenses.map((item) => ({ id: item.id, type: "expense" as const, label: item.description })),
    ...documents.map((item) => ({ id: item.id, type: "document_template" as const, label: item.title })),
    ...legislation.map((item) => ({ id: item.id, type: "legislation_item" as const, label: item.title })),
  ];

  const signed = await Promise.all(
    attachments.map(async (attachment) => {
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(attachment.storage_path ?? attachment.file_path, 60 * 60);
      return { ...attachment, signedUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <div>
      <PageHeader title="Anexos" description="Upload privado no Supabase Storage, vinculado a clientes, propostas, servicos e financeiro." />
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Novo anexo</CardTitle>
          </CardHeader>
          <CardContent>
            {entities.length ? (
              <AttachmentUploader entities={entities} />
            ) : (
              <EmptyState title="Crie algum registro antes de anexar arquivos." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Arquivos</CardTitle>
          </CardHeader>
          <CardContent>
            {signed.length ? (
              <div className="space-y-3">
                {signed.map((attachment) => (
                  <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
                    <div>
                      <p className="font-medium">{attachment.file_name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{attachment.entity_type}</Badge>
                        <Badge variant="outline">{formatDate(attachment.created_at)}</Badge>
                      </div>
                    </div>
                    {attachment.signedUrl ? (
                      <a className="text-sm font-medium text-primary hover:underline" href={attachment.signedUrl}>
                        Baixar
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum anexo enviado." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
