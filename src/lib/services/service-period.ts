import type { PeriodRange } from "@/lib/period";
import { serviceFlowSlugs } from "@/lib/services/service-flow";
import type { ServiceCard, ServiceColumn } from "@/types/database";

export type ServicePeriodCard = Pick<
  ServiceCard,
  "created_at" | "due_date" | "service_date" | "completed_at" | "column_id"
>;

export function getServiceOperationalStartDate(card: ServicePeriodCard) {
  return normalizeDate(card.service_date) ?? normalizeDate(card.created_at);
}

export function getServiceOperationalEndDate(
  card: ServicePeriodCard,
  column: Pick<ServiceColumn, "slug" | "name"> | null | undefined,
) {
  if (isConcludedServiceColumn(column)) {
    return normalizeDate(card.completed_at) ?? normalizeDate(card.due_date) ?? getServiceOperationalStartDate(card);
  }

  return normalizeDate(card.due_date) ?? getServiceOperationalStartDate(card);
}

export function isConcludedServiceColumn(
  column: Pick<ServiceColumn, "slug" | "name"> | null | undefined,
) {
  const key = `${column?.slug ?? ""} ${column?.name ?? ""}`.toLowerCase();
  return key.includes("conclu") || key.includes("finaliz");
}

export function isOverdueServiceColumn(
  column: Pick<ServiceColumn, "slug" | "name"> | null | undefined,
) {
  return column?.slug === serviceFlowSlugs.overdue || /em atraso/i.test(column?.name ?? "");
}

export function isLostServiceColumn(
  column: Pick<ServiceColumn, "slug" | "name"> | null | undefined,
) {
  const key = `${column?.slug ?? ""} ${column?.name ?? ""}`.toLowerCase();
  return key.includes("servico-perdido") || key.includes("servico perdido");
}

export function isServiceOverdue(
  card: ServicePeriodCard,
  column: Pick<ServiceColumn, "slug" | "name"> | null | undefined,
  today = new Date().toISOString().slice(0, 10),
) {
  const dueDate = normalizeDate(card.due_date);
  if (!dueDate) return false;
  if (isConcludedServiceColumn(column) || isLostServiceColumn(column)) return false;
  return dueDate < today;
}

export function serviceIntersectsPeriod(
  card: ServicePeriodCard,
  column: Pick<ServiceColumn, "slug" | "name"> | null | undefined,
  range: PeriodRange,
) {
  if (range.period === "all") return true;

  const start = getServiceOperationalStartDate(card);
  const end = getServiceOperationalEndDate(card, column) ?? start;

  if (!start || !end) return true;
  if (range.from && end < range.from) return false;
  if (range.to && start > range.to) return false;
  return true;
}

export function filterServiceCardsByOperationalPeriod<T extends ServicePeriodCard>(
  cards: T[],
  columnsById: Map<string, Pick<ServiceColumn, "slug" | "name">>,
  range: PeriodRange,
  today = new Date().toISOString().slice(0, 10),
) {
  return cards.filter((card) => {
    const column = columnsById.get(card.column_id);
    if (isServiceOverdue(card, column, today)) return true;
    return serviceIntersectsPeriod(card, column, range);
  });
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match?.[0] ?? null;
}
