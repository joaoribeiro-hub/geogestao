import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChecklistItemForm,
  ChecklistToggle,
} from "@/components/forms/checklist-forms";
import { ProfessionalDocumentsPanel } from "@/components/documents/professional-documents-panel";
import { AttachmentUploader } from "@/components/forms/attachment-uploader";
import {
  ServiceClientCreatePanel,
  ServiceEditModal,
  ServiceFinancePanel,
  ServiceFieldSelect,
  ServiceInteractionForm,
  ServiceMemberForm,
  ServicePropertyInfoPanel,
  ServiceQuickActionButton,
} from "@/components/services/service-detail-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { canManageOrganization, getCurrentOrganizationContext } from "@/lib/organization";
import {
  buildServiceSummary,
  paymentStatusLabels,
  priorityLabels,
  serviceTypeLabels,
} from "@/lib/services/service-flow";
import { getServiceEstimatedValue } from "@/lib/services/service-finance";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Json } from "@/types/database";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const organization = context.organization;
  if (!organization || !context.membership) notFound();
  const { data: card } = await supabase
    .from("service_cards")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();
  if (!card) notFound();

  const [
    { data: client },
    { data: column },
    checklistsResult,
    movementsResult,
    attachmentsResult,
    proposalResult,
    contractResult,
    membersResult,
    orgMembersResult,
    eventsResult,
    propertyInfosResult,
    revenuesResult,
    clientsResult,
  ] = await Promise.all([
    card.client_id
      ? supabase
          .from("clients")
          .select("*")
          .eq("id", card.client_id)
          .eq("organization_id", organization.id)
          .single()
      : Promise.resolve({ data: null }),
    supabase.from("service_columns").select("*").eq("id", card.column_id).single(),
    supabase.from("checklists").select("*").eq("service_card_id", card.id).order("position"),
    supabase
      .from("service_card_movements")
      .select("*")
      .eq("service_card_id", card.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attachments")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("entity_type", "service_card")
      .eq("entity_id", card.id)
      .order("created_at", { ascending: false }),
    card.proposal_id
      ? supabase
          .from("proposals")
          .select("*")
          .eq("id", card.proposal_id)
          .eq("organization_id", organization.id)
          .maybeSingle()
      : supabase
          .from("proposals")
          .select("*")
          .eq("service_card_id", card.id)
          .eq("organization_id", organization.id)
          .maybeSingle(),
    card.contract_id
      ? supabase
          .from("contracts")
          .select("*")
          .eq("id", card.contract_id)
          .eq("organization_id", organization.id)
          .maybeSingle()
      : supabase
          .from("contracts")
          .select("*")
          .eq("service_card_id", card.id)
          .eq("organization_id", organization.id)
          .maybeSingle(),
    supabase
      .from("service_members")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("service_card_id", card.id),
    supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("status", "active"),
    supabase
      .from("service_events")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("service_card_id", card.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("service_property_infos")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("service_card_id", card.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("revenues")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("service_card_id", card.id)
      .order("due_date", { ascending: false }),
    supabase
      .from("clients")
      .select("*")
      .eq("organization_id", organization.id)
      .order("name"),
  ]);

  const checklists = checklistsResult.data ?? [];
  const movements = movementsResult.data ?? [];
  const attachments = attachmentsResult.data ?? [];
  const proposal = proposalResult.data ?? null;
  const contract = contractResult.data ?? null;
  const currentMembers = membersResult.data ?? [];
  const orgMembers = orgMembersResult.data ?? [];
  const events = eventsResult.data ?? [];
  const propertyInfos = propertyInfosResult.data ?? [];
  const revenues = revenuesResult.data ?? [];
  const clients = clientsResult.data ?? [];
  const boardColumns = column
    ? (
        await supabase
          .from("service_columns")
          .select("*")
          .eq("board_id", column.board_id)
          .order("position")
      ).data ?? []
    : [];

  const memberUserIds = Array.from(
    new Set([...orgMembers.map((member) => member.user_id), ...currentMembers.map((member) => member.user_id)]),
  );
  const { data: profiles } = memberUserIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", memberUserIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const checklistIds = checklists.map((checklist) => checklist.id);
  const itemsResult = checklistIds.length
    ? await supabase
        .from("checklist_items")
        .select("*")
        .in("checklist_id", checklistIds)
        .is("deleted_at", null)
        .is("archived_at", null)
        .order("position")
    : { data: [] };
  const items = itemsResult.data ?? [];
  const summary = buildServiceSummary({
    card,
    columnName: column?.name ?? "Sem etapa",
    hasClient: Boolean(client),
    attachmentCount: attachments.length,
  });
  const metadata = asRecord(card.custom_fields_json);
  const isOwner = canManageOrganization({ profile: null, membership: context.membership });
  const canEditService = isOwner || card.responsible_user_id === user.id;
  const canSeeFinance = canEditService;
  const responsibleName = card.responsible_user_id
    ? profileMap.get(card.responsible_user_id)?.full_name ?? "Responsavel"
    : textValue(metadata.responsavel_principal);
  const receivedTotal = revenues
    .filter((revenue) => !revenue.auto_generated && revenue.status === "paid")
    .reduce((sum, revenue) => sum + Number(revenue.amount ?? 0), 0);
  const combinedValue = getServiceEstimatedValue(card);
  const serviceIsActive = !/conclu/i.test(column?.name ?? "") && !/conclu/i.test(column?.slug ?? "");

  return (
    <div className="space-y-6">
      <header className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-base font-semibold">
              {client ? (
                <Link href={`/clientes/${client.id}`} className="hover:underline">
                  {client.name}
                </Link>
              ) : (
                "Servico sem cliente"
              )}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">{card.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {card.description ?? "Sem observacoes iniciais."}
            </p>
          </div>
          <Badge variant="secondary">
            {card.service_type === "outros_servicos" && card.custom_service_name
              ? card.custom_service_name
              : serviceTypeLabels[card.service_type ?? "outros_servicos"]}
          </Badge>
          <Badge variant={serviceIsActive ? "default" : "destructive"}>
            {serviceIsActive ? "Ativo" : "Inativo"}
          </Badge>
          {canEditService ? (
            <ServiceEditModal
              card={card}
              clients={client ? [client] : []}
              columns={boardColumns}
              members={orgMembers.map((member) => ({
                id: member.user_id,
                label: profileMap.get(member.user_id)?.full_name ?? member.role,
              }))}
            />
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {!client ? (
            <ServiceClientCreatePanel
              serviceCardId={card.id}
              clients={clients}
              canEdit={canEditService}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Resumo do servico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="rounded-md bg-secondary p-3 text-muted-foreground">{summary}</p>
              <div className="flex flex-wrap gap-2">
                <ServiceFieldSelect
                  cardId={card.id}
                  label="Etapa"
                  kind="stage"
                  value={card.column_id}
                  options={boardColumns.map((item) => ({ value: item.id, label: item.name }))}
                />
                <ServiceFieldSelect
                  cardId={card.id}
                  label="Prioridade"
                  kind="priority"
                  value={card.priority}
                  options={[
                    { value: "low", label: priorityLabels.low },
                    { value: "medium", label: priorityLabels.medium },
                    { value: "high", label: priorityLabels.high },
                  ]}
                />
                <ServiceFieldSelect
                  cardId={card.id}
                  label="Pagamento"
                  kind="payment"
                  value={card.payment_status}
                  options={[
                    {
                      value: "pagamento_nao_efetuado",
                      label: paymentStatusLabels.pagamento_nao_efetuado,
                    },
                    {
                      value: "pagamento_efetuado",
                      label: paymentStatusLabels.pagamento_efetuado,
                    },
                  ]}
                />
                <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">
                  {Number(card.checklist_percent ?? 0).toFixed(0)}% concluido
                </span>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <Info label="Data prevista" value={formatDate(card.due_date)} />
                <Info label="Municipio" value={card.municipality || "-"} />
                <Info label="Responsavel principal" value={responsibleName} />
              </div>
            </CardContent>
          </Card>

          {canSeeFinance ? (
            <ServiceFinancePanel
              serviceCardId={card.id}
              combinedValue={combinedValue}
              paymentCondition={card.payment_condition || textValue(metadata.condicao_pagamento)}
              receivedTotal={receivedTotal}
              revenues={revenues.filter((revenue) => !revenue.auto_generated)}
            />
          ) : null}

          <ServicePropertyInfoPanel serviceCardId={card.id} items={propertyInfos} />

          <Card>
            <CardHeader>
              <CardTitle>Proposta e contrato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <DocumentBox
                title="Proposta"
                href={proposal ? `/propostas/${proposal.id}` : null}
                emptyText="Este servico ainda nao possui proposta."
                action={<ServiceQuickActionButton serviceCardId={card.id} action="proposal">Criar proposta</ServiceQuickActionButton>}
              />
              <DocumentBox
                title="Contrato"
                href={contract ? `/contratos/${contract.id}` : null}
                emptyText="Este servico ainda nao possui contrato."
                action={<ServiceQuickActionButton serviceCardId={card.id} action="contract">Criar contrato</ServiceQuickActionButton>}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist - Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {checklists.filter((checklist) => checklist.checklist_type === "documents").length ? (
                checklists
                  .filter((checklist) => checklist.checklist_type === "documents")
                  .map((checklist) => {
                  const checklistItems = items.filter(
                    (item) => item.checklist_id === checklist.id,
                  );
                  return (
                    <div key={checklist.id} className="rounded-lg border p-4">
                      <h2 className="mb-3 text-sm font-semibold">{checklist.title}</h2>
                      <div className="mb-3 space-y-2">
                        {checklistItems.map((item) => (
                          <ChecklistToggle
                            key={item.id}
                            itemId={item.id}
                            checklistId={checklist.id}
                            checked={item.is_done}
                            label={item.title}
                            createdAt={item.created_at}
                            completedAt={item.completed_at}
                            dueDate={item.due_date}
                            dueTime={item.due_time}
                            canDelete
                          />
                        ))}
                      </div>
                      <ChecklistItemForm checklistId={checklist.id} checklistType="documents" />
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border p-4">
                  <EmptyState title="Nenhum item de documento cadastrado." />
                  <div className="mt-3">
                    <ChecklistItemForm serviceCardId={card.id} checklistType="documents" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist - Etapas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {checklists.filter((checklist) => checklist.checklist_type === "steps").length ? (
                checklists
                  .filter((checklist) => checklist.checklist_type === "steps")
                  .map((checklist) => {
                    const checklistItems = items.filter((item) => item.checklist_id === checklist.id);
                    return (
                      <div key={checklist.id} className="rounded-lg border p-4">
                        <h2 className="mb-3 text-sm font-semibold">{checklist.title}</h2>
                        <div className="mb-3 space-y-2">
                          {checklistItems.map((item) => (
                            <ChecklistToggle
                              key={item.id}
                              itemId={item.id}
                              checklistId={checklist.id}
                              checked={item.is_done}
                              label={item.title}
                              createdAt={item.created_at}
                              completedAt={item.completed_at}
                              dueDate={item.due_date}
                              dueTime={item.due_time}
                              canDelete
                              allowSchedule
                            />
                          ))}
                        </div>
                        <ChecklistItemForm checklistId={checklist.id} checklistType="steps" allowSchedule />
                      </div>
                    );
                  })
              ) : (
                <div className="rounded-lg border p-4">
                  <EmptyState title="Nenhuma etapa cadastrada." />
                  <div className="mt-3">
                    <ChecklistItemForm serviceCardId={card.id} checklistType="steps" allowSchedule />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <ProfessionalDocumentsPanel
            title="Documentos profissionais do servico"
            relatedType="service"
            serviceId={card.id}
            clientId={card.client_id ?? undefined}
          />

          <Card id="anexos">
            <CardHeader>
              <CardTitle>Anexos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AttachmentUploader
                entities={[{ id: card.id, type: "service_card", label: card.title }]}
              />
              {attachments.length ? (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="rounded-md border bg-background p-3 text-sm">
                      <p className="font-medium">{attachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {attachment.category ?? "Anexo"} · {formatDate(attachment.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhum anexo registrado." />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Membros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ServiceMemberForm
                serviceCardId={card.id}
                members={orgMembers.map((member) => ({
                  id: member.user_id,
                  label: profileMap.get(member.user_id)?.full_name ?? member.role,
                }))}
              />
              {currentMembers.length ? (
                <div className="space-y-2">
                  {currentMembers.map((member) => (
                    <div key={member.id} className="rounded-md border bg-background p-3 text-sm">
                      <p className="font-medium">
                        {profileMap.get(member.user_id)?.full_name ?? "Membro"}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhum membro vinculado." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimentacoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ServiceInteractionForm serviceCardId={card.id} />
              {events.length || movements.length ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="rounded-md border bg-background p-3 text-sm">
                      <p className="font-medium">{event.title}</p>
                      {event.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                    </div>
                  ))}
                  {movements.map((movement) => (
                    <div key={movement.id} className="rounded-md border bg-background p-3 text-sm">
                      <p className="font-medium">Movimentacao de etapa</p>
                      <p className="text-xs text-muted-foreground">{formatDate(movement.created_at)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sem movimentacoes registradas." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function DocumentBox({
  title,
  href,
  emptyText,
  action,
}: {
  title: string;
  href: string | null;
  emptyText: string;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-background p-4" id={title.toLowerCase()}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {href ? (
        <Link href={href} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
          Visualizar {title.toLowerCase()}
        </Link>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
          {action}
        </div>
      )}
    </div>
  );
}

function asRecord(value: Json): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}

function textValue(value: Json | undefined) {
  return typeof value === "string" && value ? value : "-";
}
