import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { canManageOrganization, getCurrentOrganizationContext } from "@/lib/organization";
import {
  calculateDailyWorkSummary,
  calculatePeriodWorkSummary,
  dateRangeInclusive,
  formatDuration,
  getSaoPauloDateKey,
} from "@/lib/services/work-time";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import type { CompanyHoliday, TeamMember, WorkTimeDay, WorkTimeEvent } from "@/types/database";

type TaskRow = {
  id: string;
  title: string;
  responsibleId: string;
  creatorId: string;
  responsibleName: string;
  creatorName: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  source: string;
  originHref: string | null;
  dateKey: string;
};

const quickFilters = [
  { id: "open", label: "Todas as tarefas abertas" },
  { id: "recent", label: "Tarefas criadas recentemente" },
  { id: "done", label: "Todas as tarefas concluidas" },
  { id: "pending", label: "Todas as tarefas pendentes" },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const quick = params.quick ?? "open";
  const status = params.status ?? "open";
  const dateFilter = params.date ?? "today";
  const customDate = params.customDate ?? "";
  const member = params.member ?? "all";
  const workView = params.workView ?? "daily";
  const workDate = params.workDate ?? getSaoPauloDateKey();
  const workMonth = params.workMonth ?? workDate.slice(0, 7);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) return null;
  const organization = context.organization;
  const isOwner = canManageOrganization({ profile: context.profile, membership: context.membership });
  const today = toDateKey(new Date());
  const dateRange = resolveDateRange(dateFilter, customDate, today);

  const [membersResult, profilesResult, dailyResult, routineResult] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", organization.id)
      .eq("status", "active"),
    supabase.from("profiles").select("id,full_name"),
    supabase
      .from("daily_checklist_items")
      .select("*")
      .eq("organization_id", organization.id)
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso),
    supabase
      .from("routine_items")
      .select("*")
      .eq("organization_id", organization.id)
      .gte("created_at", dateRange.fromIso)
      .lte("created_at", dateRange.toIso),
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name ?? profile.id]));
  const memberOptions = (membersResult.data ?? []).map((item) => ({
    id: item.user_id,
    label: profileMap.get(item.user_id) ?? item.role,
  }));

  const rows: TaskRow[] = [
    ...((dailyResult.data ?? []).map((item) => ({
      id: `daily-${item.id}`,
      title: item.title,
      responsibleId: item.assigned_to,
      creatorId: item.created_by,
      responsibleName: profileMap.get(item.assigned_to) ?? "Membro",
      creatorName: profileMap.get(item.created_by) ?? "Membro",
      createdAt: item.created_at,
      completedAt: item.completed_at,
      status: item.deleted_at ? "deleted" : item.archived_at ? "archived" : item.status,
      source: "Checklist de Hoje",
      originHref: item.related_service_id ? `/servicos/${item.related_service_id}` : "/rotina",
      dateKey: item.due_date ?? item.created_at.slice(0, 10),
    })) satisfies TaskRow[]),
    ...((routineResult.data ?? []).map((item) => ({
      id: `routine-${item.id}`,
      title: item.title,
      responsibleId: item.user_id,
      creatorId: item.created_by ?? item.user_id,
      responsibleName: profileMap.get(item.user_id) ?? "Membro",
      creatorName: profileMap.get(item.created_by ?? item.user_id) ?? "Membro",
      createdAt: item.created_at,
      completedAt: item.completed_at,
      status: item.deleted_at ? "deleted" : item.archived_at ? "archived" : item.status,
      source: "Rotina",
      originHref: "/rotina",
      dateKey: item.routine_date ?? item.created_at.slice(0, 10),
    })) satisfies TaskRow[]),
  ]
    .filter((row) => member === "all" || row.responsibleId === member)
    .filter((row) => filterByStatus(row, quick, status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const chart = buildWeekChart(rows);
  const maxValue = Math.max(1, ...chart.map((item) => item.count));
  const workReport = await loadWorkReport({
    supabase,
    organizationId: organization.id,
    currentUserId: user.id,
    isOwner,
    view: workView,
    selectedDate: workDate,
    selectedMonth: workMonth,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatorios"
        description="Tarefas, checklists e rotina dos membros da empresa."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {quickFilters.map((filter) => (
            <Link
              key={filter.id}
              href={`/relatorios?quick=${filter.id}`}
              className={cn(
                "block rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground",
                quick === filter.id && "border-primary text-primary",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </aside>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Horas de expediente</CardTitle>
              <p className="text-sm text-muted-foreground">
                Relatorio operacional interno. Nao substitui ponto eletronico legal nesta fase.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="quick" value={quick} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="date" value={dateFilter} />
                <input type="hidden" name="member" value={member} />
                <Select name="workView" label="Visao" defaultValue={workView}>
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </Select>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data</label>
                  <Input name="workDate" type="date" defaultValue={workDate} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mes</label>
                  <Input name="workMonth" type="month" defaultValue={workMonth} />
                </div>
                <button className="self-end rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  Atualizar horas
                </button>
              </form>

              {workReport.rows.length ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">Membro</th>
                        <th className="px-4 py-3 font-medium">Periodo</th>
                        <th className="px-4 py-3 font-medium">Trabalhado</th>
                        <th className="px-4 py-3 font-medium">Intervalo</th>
                        <th className="px-4 py-3 font-medium">Campo</th>
                        <th className="px-4 py-3 font-medium">Exigido</th>
                        <th className="px-4 py-3 font-medium">Faltante</th>
                        <th className="px-4 py-3 font-medium">Extra</th>
                        <th className="px-4 py-3 font-medium">Status/eventos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workReport.rows.map((row) => (
                        <tr key={row.key} className="border-t bg-card align-top">
                          <td className="px-4 py-3 font-medium">{row.memberName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.periodLabel}</td>
                          <td className="px-4 py-3">{formatDuration(row.workedSeconds)}</td>
                          <td className="px-4 py-3">{formatDuration(row.intervalSeconds)}</td>
                          <td className="px-4 py-3">{formatDuration(row.fieldSeconds)}</td>
                          <td className="px-4 py-3">{formatDuration(row.expectedSeconds)}</td>
                          <td className="px-4 py-3">{formatDuration(row.missingSeconds)}</td>
                          <td className="px-4 py-3">{formatDuration(row.overtimeSeconds)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <p>{row.statusLabel}</p>
                            <p>{row.safetyCount} confirmacao(oes)</p>
                            <p>{row.intervalCount} evento(s) de intervalo</p>
                            <p>{row.fieldCount} evento(s) de campo</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Nenhum registro de expediente encontrado para o periodo." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <form className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="quick" value={quick} />
                <Select name="status" label="Status" defaultValue={status}>
                  <option value="open">Aberta</option>
                  <option value="done">Concluida</option>
                  <option value="deleted">Excluida</option>
                  <option value="archived">Arquivada</option>
                  <option value="all">Todas</option>
                </Select>
                <Select name="date" label="Data" defaultValue={dateFilter}>
                  <option value="today">Hoje</option>
                  <option value="yesterday">Ontem</option>
                  <option value="tomorrow">Amanha</option>
                  <option value="custom">Data personalizada</option>
                  <option value="all">Todas recentes</option>
                </Select>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data personalizada</label>
                  <Input name="customDate" type="date" defaultValue={customDate} />
                </div>
                <Select name="member" label="Membro" defaultValue={member}>
                  <option value="all">Todos</option>
                  {memberOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <button className="md:col-span-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  Aplicar filtros
                </button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5" aria-hidden="true" />
                Tarefas por dia da semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 items-end gap-2">
                {chart.map((item) => (
                  <div key={item.label} className="space-y-2 text-center">
                    <div className="flex h-36 items-end rounded-md bg-secondary p-1">
                      <div
                        className="w-full rounded bg-primary"
                        style={{ height: `${Math.max(8, (item.count / maxValue) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold">{item.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">Tarefa</th>
                        <th className="px-4 py-3 font-medium">Membro</th>
                        <th className="px-4 py-3 font-medium">Criador</th>
                        <th className="px-4 py-3 font-medium">Criacao</th>
                        <th className="px-4 py-3 font-medium">Conclusao</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-t bg-card">
                          <td className="px-4 py-3 font-medium">
                            {row.originHref ? <Link href={row.originHref}>{row.title}</Link> : row.title}
                          </td>
                          <td className="px-4 py-3">{row.responsibleName}</td>
                          <td className="px-4 py-3">{row.creatorName}</td>
                          <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                          <td className="px-4 py-3">{row.completedAt ? formatDate(row.completedAt) : "-"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={row.status === "done" ? "secondary" : "outline"}>{statusLabel(row.status)}</Badge>
                          </td>
                          <td className="px-4 py-3">{row.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Nenhuma tarefa encontrada para os filtros." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Select({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <select name={name} defaultValue={defaultValue} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        {children}
      </select>
    </div>
  );
}

function filterByStatus(row: TaskRow, quick: string, status: string) {
  const effective = quick === "done" ? "done" : quick === "pending" || quick === "open" ? "open" : status;
  if (quick === "recent") return true;
  if (effective === "all") return true;
  if (effective === "open") return row.status === "open";
  if (effective === "done") return row.status === "done";
  if (effective === "deleted") return row.status === "deleted";
  if (effective === "archived") return row.status === "archived";
  return true;
}

function buildWeekChart(rows: TaskRow[]) {
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const counts = labels.map((label) => ({ label, count: 0 }));
  rows.forEach((row) => {
    const index = new Date(`${row.dateKey}T00:00:00-03:00`).getDay();
    counts[index].count += 1;
  });
  return counts;
}

function resolveDateRange(filter: string, customDate: string, today: string) {
  const date =
    filter === "yesterday"
      ? shift(today, -1)
      : filter === "tomorrow"
        ? shift(today, 1)
        : filter === "custom" && customDate
          ? customDate
          : today;
  if (filter === "all") {
    return { fromIso: "2000-01-01T00:00:00.000Z", toIso: "2099-12-31T23:59:59.999Z" };
  }
  return {
    fromIso: `${date}T00:00:00.000-03:00`,
    toIso: `${date}T23:59:59.999-03:00`,
  };
}

function shift(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00-03:00`);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function statusLabel(status: string) {
  if (status === "done") return "Concluida";
  if (status === "deleted") return "Excluida";
  if (status === "archived") return "Arquivada";
  if (status === "canceled") return "Cancelada";
  return "Aberta";
}

async function loadWorkReport({
  supabase,
  organizationId,
  currentUserId,
  isOwner,
  view,
  selectedDate,
  selectedMonth,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  currentUserId: string;
  isOwner: boolean;
  view: string;
  selectedDate: string;
  selectedMonth: string;
}) {
  const range = resolveWorkRange(view, selectedDate, selectedMonth);
  const memberQuery = supabase
    .from("organization_members")
    .select("user_id,role,created_at")
    .eq("organization_id", organizationId)
    .eq("status", "active");
  const { data: organizationMembers } = isOwner
    ? await memberQuery
    : await memberQuery.eq("user_id", currentUserId);
  const userIds = (organizationMembers ?? []).map((member) => member.user_id);
  if (!userIds.length) return { rows: [] as WorkReportRow[] };

  const [{ data: profiles }, { data: teamMembers }, { data: days }, { data: events }, { data: holidays }] =
    await Promise.all([
      supabase.from("profiles").select("id,full_name,email").in("id", userIds),
      supabase.from("team_members").select("*").eq("organization_id", organizationId),
      supabase
        .from("work_time_days")
        .select("*")
        .eq("organization_id", organizationId)
        .in("user_id", userIds)
        .gte("work_date", range.from)
        .lte("work_date", range.to),
      supabase
        .from("work_time_events")
        .select("*")
        .eq("organization_id", organizationId)
        .in("user_id", userIds)
        .gte("occurred_at", `${range.from}T00:00:00.000-03:00`)
        .lte("occurred_at", `${range.to}T23:59:59.999-03:00`),
      supabase
        .from("company_holidays")
        .select("*")
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .gte("date", `${range.from.slice(0, 4)}-01-01`)
        .lte("date", `${range.to.slice(0, 4)}-12-31`),
    ]);

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? profile.email ?? profile.id]));
  const scheduleByUser = new Map(
    (teamMembers ?? [])
      .filter((member) => member.auth_user_id)
      .map((member) => [member.auth_user_id!, member as TeamMember]),
  );
  const daysByUserDate = new Map((days ?? []).map((day) => [`${day.user_id}:${day.work_date}`, day as WorkTimeDay]));
  const eventsByDay = new Map<string, WorkTimeEvent[]>();
  (events ?? []).forEach((event) => {
    const key = event.work_day_id;
    const current = eventsByDay.get(key) ?? [];
    current.push(event as WorkTimeEvent);
    eventsByDay.set(key, current);
  });
  const dateKeys = dateRangeInclusive(range.from, range.to);

  const rows = userIds.map((userId) => {
    const daily = dateKeys.map((date) => {
      const day = daysByUserDate.get(`${userId}:${date}`);
      return calculateDailyWorkSummary({
        day,
        events: day ? eventsByDay.get(day.id) ?? [] : [],
        schedule: scheduleByUser.get(userId),
        holidays: (holidays ?? []) as CompanyHoliday[],
        date,
      });
    });
    const total = calculatePeriodWorkSummary(daily);
    const latestDay = [...daily].reverse().find((item) => item.worked_seconds > 0 || item.status !== "closed");
    return {
      key: `${userId}:${range.from}:${range.to}`,
      memberName: profileMap.get(userId) ?? "Membro",
      periodLabel: range.label,
      workedSeconds: total.worked_seconds,
      intervalSeconds: total.interval_seconds,
      fieldSeconds: total.field_seconds,
      expectedSeconds: total.expected_seconds,
      missingSeconds: total.missing_seconds,
      overtimeSeconds: total.overtime_seconds,
      statusLabel: latestDay ? statusLabelWork(latestDay.status) : "Sem registro",
      safetyCount: daily.reduce((sum, day) => sum + day.safety_confirmations.length, 0),
      intervalCount: daily.reduce((sum, day) => sum + day.intervals.length, 0),
      fieldCount: daily.reduce((sum, day) => sum + day.field_periods.length, 0),
    } satisfies WorkReportRow;
  });

  return { rows };
}

type WorkReportRow = {
  key: string;
  memberName: string;
  periodLabel: string;
  workedSeconds: number;
  intervalSeconds: number;
  fieldSeconds: number;
  expectedSeconds: number;
  missingSeconds: number;
  overtimeSeconds: number;
  statusLabel: string;
  safetyCount: number;
  intervalCount: number;
  fieldCount: number;
};

function resolveWorkRange(view: string, selectedDate: string, selectedMonth: string) {
  if (view === "monthly") {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const last = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    return { from: start, to: end, label: selectedMonth };
  }
  if (view === "weekly") {
    const date = new Date(`${selectedDate}T12:00:00-03:00`);
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const startDate = new Date(date);
    startDate.setDate(date.getDate() + diffToMonday);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const from = toDateKey(startDate);
    const to = toDateKey(endDate);
    return { from, to, label: `${from} a ${to}` };
  }
  return { from: selectedDate, to: selectedDate, label: selectedDate };
}

function statusLabelWork(status: string) {
  if (status === "paused_interval") return "Intervalo";
  if (status === "field_mode") return "Campo";
  if (status === "safety_frozen") return "Congelado";
  if (status === "closed") return "Encerrado";
  return "Ativo";
}
