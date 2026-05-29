import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { AgendaCalendar, type AgendaEvent } from "@/components/agenda/agenda-calendar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  adjacentMonths,
  buildMonthGrid,
  formatMonthTitle,
  monthBounds,
  parseMonthParam,
} from "@/lib/agenda/calendar";
import { requireUser } from "@/lib/auth";
import { canManageOrganization, getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization) return null;

  const monthData = parseMonthParam(month);
  const { from, to } = monthBounds(monthData.year, monthData.monthIndex);
  const nav = adjacentMonths(monthData.year, monthData.monthIndex);
  const days = buildMonthGrid(monthData.year, monthData.monthIndex);

  const [servicesResult, remindersResult, membersResult, holidaysResult] = await Promise.all([
    supabase
      .from("service_cards")
      .select("id,title,service_date,due_date")
      .eq("organization_id", context.organization.id)
      .or(`and(service_date.gte.${from},service_date.lte.${to}),and(due_date.gte.${from},due_date.lte.${to})`)
      .order("due_date"),
    supabase
      .from("agenda_reminders")
      .select("*")
      .eq("organization_id", context.organization.id)
      .lte("reminder_date", to)
      .is("canceled_at", null)
      .order("reminder_date"),
    supabase
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", context.organization.id)
      .eq("status", "active"),
    supabase
      .from("company_holidays")
      .select("*")
      .or(`organization_id.is.null,organization_id.eq.${context.organization.id}`)
      .lte("date", to)
      .gte("date", from)
      .order("date"),
  ]);

  const members = membersResult.data ?? [];
  const { data: profiles } = members.length
    ? await supabase.from("profiles").select("id,full_name").in("id", members.map((member) => member.user_id))
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const memberOptions = members.map((member) => ({
    id: member.user_id,
    label: profileMap.get(member.user_id) ?? member.role,
  }));
  const isOwner = canManageOrganization({ profile: null, membership: context.membership });

  const serviceEvents = (servicesResult.data ?? []).flatMap<AgendaEvent>((service) => {
    const events: AgendaEvent[] = [];
    if (service.service_date && service.service_date >= from && service.service_date <= to) {
      events.push({
        id: `service-start-${service.id}`,
        date: service.service_date,
        type: "Servico",
        title: service.title,
        description: "Inicio operacional do servico.",
        href: `/servicos/${service.id}`,
      });
    }
    if (service.due_date && service.due_date >= from && service.due_date <= to) {
      events.push({
        id: `service-due-${service.id}`,
        date: service.due_date,
        type: "Prazo",
        title: service.title,
        description: "Data prevista/final do servico.",
        href: `/servicos/${service.id}`,
      });
    }
    return events;
  });

  const reminderEvents = (remindersResult.data ?? []).flatMap<AgendaEvent>((reminder) =>
    reminderOccurrenceDates(reminder.reminder_date, reminder.recurrence, from, to).map((date) => ({
      id: `reminder-${reminder.id}-${date}`,
      date,
      type: reminder.entity_type === "client" ? "Cliente" : "Lembrete",
      title: reminder.title,
      time: reminder.reminder_time,
      description: reminder.description,
      href:
        reminder.entity_type === "service_card" && reminder.entity_id
          ? `/servicos/${reminder.entity_id}`
          : reminder.entity_type === "client" && reminder.entity_id
            ? `/clientes/${reminder.entity_id}`
            : null,
      category: reminder.category,
      customCategory: reminder.custom_category,
      recurrence: reminder.recurrence,
      reminderId: reminder.id,
      createdBy: reminder.created_by,
    })),
  );

  const { data: serviceChecklists } = await supabase
    .from("checklists")
    .select("id,service_card_id")
    .eq("organization_id", context.organization.id)
    .eq("checklist_type", "steps");
  const checklistIds = (serviceChecklists ?? []).map((checklist) => checklist.id);
  const checklistServiceIds = Array.from(
    new Set((serviceChecklists ?? []).map((checklist) => checklist.service_card_id)),
  );
  const [{ data: scheduledItems }, { data: scheduledServices }] = await Promise.all([
    checklistIds.length
      ? supabase
          .from("checklist_items")
          .select("id,checklist_id,title,due_date,due_time")
          .in("checklist_id", checklistIds)
          .gte("due_date", from)
          .lte("due_date", to)
      : Promise.resolve({ data: [] }),
    checklistServiceIds.length
      ? supabase
          .from("service_cards")
          .select("id,title")
          .eq("organization_id", context.organization.id)
          .in("id", checklistServiceIds)
      : Promise.resolve({ data: [] }),
  ]);
  const checklistServiceMap = new Map((serviceChecklists ?? []).map((item) => [item.id, item.service_card_id]));
  const serviceTitleMap = new Map((scheduledServices ?? []).map((service) => [service.id, service.title]));
  const checklistEvents = (scheduledItems ?? [])
    .filter((item) => item.due_date)
    .map<AgendaEvent>((item) => {
      const serviceId = checklistServiceMap.get(item.checklist_id) ?? "";
      return {
        id: `step-${item.id}`,
        date: item.due_date!,
        type: "Etapa",
        title: item.title,
        time: item.due_time,
        description: `Etapa do servico ${serviceTitleMap.get(serviceId) ?? "servico"}.`,
        href: serviceId ? `/servicos/${serviceId}` : null,
      };
    });

  const holidayEvents = (holidaysResult.data ?? []).map<AgendaEvent>((holiday) => ({
    id: `holiday-${holiday.id}`,
    date: holiday.date,
    type: "Feriado",
    title: holiday.name,
    description: holiday.affects_expected_hours
      ? "Feriado que reduz horas esperadas da jornada."
      : "Feriado informativo.",
    category: "Feriado",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader title="Agenda" description="Calendario mensal com prazos de servicos e lembretes da empresa." />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/agenda?month=${nav.previous}`}>
              <ChevronLeft aria-hidden="true" />
              Mes anterior
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/agenda?month=${nav.current}`}>
              <RotateCcw aria-hidden="true" />
              Mes atual
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/agenda?month=${nav.next}`}>
              Proximo mes
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold capitalize">{formatMonthTitle(monthData.year, monthData.monthIndex)}</h2>
        <AgendaCalendar
          days={days}
          events={[...serviceEvents, ...reminderEvents, ...checklistEvents, ...holidayEvents]}
          members={memberOptions}
          currentUserId={user.id}
          canUseSpecialCategories={isOwner}
        />
      </div>
    </div>
  );
}

function reminderOccurrenceDates(
  firstDate: string,
  recurrence: "none" | "weekly" | string,
  from: string,
  to: string,
) {
  if (recurrence !== "weekly") return firstDate >= from && firstDate <= to ? [firstDate] : [];
  const dates: string[] = [];
  const cursor = new Date(`${firstDate}T00:00:00-03:00`);
  const end = new Date(`${to}T00:00:00-03:00`);
  while (toDateKey(cursor) < from) cursor.setDate(cursor.getDate() + 7);
  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
