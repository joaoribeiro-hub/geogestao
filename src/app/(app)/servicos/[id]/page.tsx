import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChecklistForm,
  ChecklistItemForm,
  ChecklistToggle,
} from "@/components/forms/checklist-forms";
import { AttachmentUploader } from "@/components/forms/attachment-uploader";
import {
  ServiceClientCreatePanel,
  ServiceFieldSelect,
  ServiceInteractionForm,
  ServiceMemberForm,
  ServiceQuickActionButton,
} from "@/components/services/service-detail-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import {
  buildServiceSummary,
  paymentStatusLabels,
  priorityLabels,
  serviceTypeLabels,
} from "@/lib/services/service-flow";
import { formatBrlCurrency, getServiceEstimatedValue } from "@/lib/services/service-finance";
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
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
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
  ]);

  const checklists = checklistsResult.data ?? [];
  const movements = movementsResult.data ?? [];
  const attachments = attachmentsResult.data ?? [];
  const proposal = proposalResult.data ?? null;
  const contract = contractResult.data ?? null;
  const currentMembers = membersResult.data ?? [];
  const orgMembers = orgMembersResult.data ?? [];
  const events = eventsResult.data ?? [];
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
            {serviceTypeLabels[card.service_type ?? "outros_servicos"]}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {!client ? <ServiceClientCreatePanel serviceCardId={card.id} /> : null}

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
                <Info label="Valor previsto" value={formatBrlCurrency(getServiceEstimatedValue(card))} />
                <Info label="Responsavel principal" value={textValue(metadata.responsavel_principal)} />
              </div>
            </CardContent>
          </Card>

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
              <CardTitle>Checklists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ChecklistForm serviceCardId={card.id} />
              {checklists.length ? (
                checklists.map((checklist) => {
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
                          />
                        ))}
                      </div>
                      <ChecklistItemForm checklistId={checklist.id} />
                    </div>
                  );
                })
              ) : (
                <EmptyState title="Nenhum checklist cadastrado." />
              )}
            </CardContent>
          </Card>

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
              <CardTitle>Historico</CardTitle>
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
