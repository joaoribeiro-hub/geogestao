import Link from "next/link";
import { PeriodFilter } from "@/components/filters/period-filter";
import { ServiceKanban } from "@/components/kanban/service-kanban";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { NewServiceModal } from "@/components/services/new-service-modal";
import { ServiceImportModal } from "@/components/services/service-import-modal";
import { ServiceSchedule } from "@/components/services/service-schedule";
import { monthBounds, parseMonthParam } from "@/lib/agenda/calendar";
import { requireUser } from "@/lib/auth";
import { resolvePeriodRange } from "@/lib/period";
import { getInitialServiceColumn, getServiceColumns } from "@/lib/services/service-flow";
import { serviceTypeToBoardSlug } from "@/lib/services/service-cards";
import {
  filterServiceCardsByOperationalPeriod,
  isOverdueServiceColumn,
  isServiceOverdue,
} from "@/lib/services/service-period";
import { isServiceLostColumn } from "@/lib/services/service-finance";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ProposalServiceType, ServiceCard } from "@/types/database";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined> & { board?: string }>;
}) {
  const params = await searchParams;
  const board = Array.isArray(params.board) ? params.board[0] : params.board;
  const scheduleMonth = Array.isArray(params.scheduleMonth)
    ? params.scheduleMonth[0]
    : params.scheduleMonth;
  const periodRange = resolvePeriodRange(params, new Date(), "all");
  const scheduleMonthData = parseMonthParam(scheduleMonth);
  const scheduleBounds = monthBounds(scheduleMonthData.year, scheduleMonthData.monthIndex);
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const [boardsResult, clientsResult, orgMembersResult] = await Promise.all([
    supabase.from("service_boards").select("*").order("position"),
    supabase.from("clients").select("*").eq("organization_id", organization.id).order("name"),
    supabase
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", organization.id)
      .eq("status", "active"),
  ]);
  const boards = boardsResult.data ?? [];
  const clients = clientsResult.data ?? [];
  const orgMembers = orgMembersResult.data ?? [];
  const { data: profiles } = orgMembers.length
    ? await supabase.from("profiles").select("id,full_name").in("id", orgMembers.map((member) => member.user_id))
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const memberOptions = orgMembers.map((member) => ({
    id: member.user_id,
    label: profileMap.get(member.user_id) ?? member.role ?? "Membro",
  }));

  const selectedBoard = boards.find((item) => item.slug === board) ?? boards[0];
  const boardIds = boards.map((item) => item.id);
  const allColumnsResult = boardIds.length
    ? await supabase
        .from("service_columns")
        .select("*")
        .in("board_id", boardIds)
        .order("position")
    : { data: [] };
  const allColumns = allColumnsResult.data ?? [];
  const selectedBoardColumns = selectedBoard
    ? allColumns.filter((column) => column.board_id === selectedBoard.id)
    : [];
  const selectedServiceType = selectedBoard ? serviceTypeFromBoardSlug(selectedBoard.slug) : null;
  const columns = selectedServiceType
    ? getServiceColumns(selectedServiceType, selectedBoardColumns).filter((column) => !isServiceLostColumn(column))
    : selectedBoardColumns.filter((column) => !isServiceLostColumn(column));
  const columnByServiceType = buildInitialColumnByServiceType(boards, allColumns);

  const columnIds = columns.map((column) => column.id);
  const cardsResult = columnIds.length
    ? await supabase
        .from("service_cards")
        .select("*")
        .eq("organization_id", organization.id)
        .in("column_id", columnIds)
    : { data: [] };
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const cards = filterServiceCardsByOperationalPeriod(
    cardsResult.data ?? [],
    columnsById,
    periodRange,
  );
  const overdueColumn = columns.find((column) => isOverdueServiceColumn(column));

  if (process.env.NODE_ENV !== "production") {
    console.info("[servicos:list]", {
      organizationId: organization.id,
      board: selectedBoard?.slug,
      columns: columnIds.length,
      cardsBeforePeriod: cardsResult.data?.length ?? 0,
      cardsAfterPeriod: cards.length,
      period: periodRange.period,
      from: periodRange.from,
      to: periodRange.to,
    });
  }

  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const cardsWithClients = cards.map((card) => ({
    ...displayCardInOverdueColumn(card, columnsById, overdueColumn),
    client: card.client_id ? clientMap.get(card.client_id) ?? null : null,
  }));
  const { data: scheduleCards } = await supabase
    .from("service_cards")
    .select("id,title,service_date,due_date")
    .eq("organization_id", organization.id)
    .or(`and(service_date.gte.${scheduleBounds.from},service_date.lte.${scheduleBounds.to}),and(due_date.gte.${scheduleBounds.from},due_date.lte.${scheduleBounds.to})`);
  const { data: scheduleChecklists } = await supabase
    .from("checklists")
    .select("id,service_card_id")
    .eq("organization_id", organization.id)
    .eq("checklist_type", "steps");
  const scheduleChecklistIds = (scheduleChecklists ?? []).map((checklist) => checklist.id);
  const { data: scheduleItems } = scheduleChecklistIds.length
    ? await supabase
        .from("checklist_items")
        .select("id,checklist_id,title,due_date")
        .in("checklist_id", scheduleChecklistIds)
        .gte("due_date", scheduleBounds.from)
        .lte("due_date", scheduleBounds.to)
    : { data: [] };
  const scheduleChecklistMap = new Map((scheduleChecklists ?? []).map((item) => [item.id, item.service_card_id]));
  const scheduleEvents = [
    ...((scheduleCards ?? []).flatMap((card) => {
      const events = [];
      if (card.service_date) {
        events.push({
          id: `service-start-${card.id}`,
          date: card.service_date,
          title: card.title,
          type: "Inicio" as const,
          href: `/servicos/${card.id}`,
        });
      }
      if (card.due_date) {
        events.push({
          id: `service-due-${card.id}`,
          date: card.due_date,
          title: card.title,
          type: "Prazo" as const,
          href: `/servicos/${card.id}`,
        });
      }
      return events;
    }) ?? []),
    ...((scheduleItems ?? [])
      .filter((item) => item.due_date)
      .map((item) => {
        const serviceId = scheduleChecklistMap.get(item.checklist_id) ?? "";
        return {
          id: `step-${item.id}`,
          date: item.due_date!,
          title: item.title,
          type: "Etapa" as const,
          href: serviceId ? `/servicos/${serviceId}` : "/servicos",
        };
      }) ?? []),
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Servicos"
          description="Centro da operacao: documentos, proposta, contrato, execucao, equipe e financeiro em um quadro simples."
        />
        <div className="flex flex-wrap gap-2">
          <ServiceImportModal selectedBoardId={selectedBoard?.id ?? null} />
          <NewServiceModal
            clients={clients}
            columns={allColumns}
            columnByServiceType={columnByServiceType}
            members={memberOptions}
          />
        </div>
      </div>

      <PeriodFilter
        range={periodRange}
        action="/servicos"
        preserveParams={{ board: selectedBoard?.slug }}
        compact
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {boards.map((item) => (
          <Link
            key={item.id}
            href={`/servicos?board=${item.slug}`}
            className={cn(
              "rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground",
              selectedBoard?.id === item.id && "border-primary text-primary",
            )}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {!selectedBoard ? (
        <EmptyState title="Execute o seed para criar os quadros padrao." />
      ) : (
        <div className="grid gap-6">
          <ServiceKanban columns={columns} cards={cardsWithClients} />
          <ServiceSchedule month={scheduleMonth} events={scheduleEvents} />
        </div>
      )}
    </div>
  );
}

function displayCardInOverdueColumn(
  card: ServiceCard,
  columnsById: Map<string, { slug: string; name: string }>,
  overdueColumn: { id: string; slug: string; name: string } | undefined,
) {
  if (!overdueColumn) return card;
  const currentColumn = columnsById.get(card.column_id);
  if (!isServiceOverdue(card, currentColumn)) {
    return card;
  }
  return { ...card, column_id: overdueColumn.id };
}

function serviceTypeFromBoardSlug(slug: string): ProposalServiceType | null {
  const found = (Object.entries(serviceTypeToBoardSlug) as Array<[ProposalServiceType, string]>)
    .find(([, boardSlug]) => boardSlug === slug);
  return found?.[0] ?? null;
}

function buildInitialColumnByServiceType(
  boards: Array<{ id: string; slug: string }>,
  columns: Array<{ id: string; board_id: string; slug: string; position: number; name: string; created_at: string; updated_at?: string | null }>,
) {
  const map: Partial<Record<ProposalServiceType, string>> = {};
  (Object.entries(serviceTypeToBoardSlug) as Array<[ProposalServiceType, string]>).forEach(
    ([serviceType, boardSlug]) => {
      const board = boards.find((item) => item.slug === boardSlug);
      if (!board) return;
      const initialColumn = getInitialServiceColumn(
        columns.filter((column) => column.board_id === board.id),
      );
      if (initialColumn) map[serviceType] = initialColumn.id;
    },
  );
  return map;
}
