export type CalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
};

export function parseMonthParam(value: string | undefined, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    return {
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    };
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return { year, monthIndex, month: `${year}-${String(monthIndex + 1).padStart(2, "0")}` };
}

export function monthBounds(year: number, monthIndex: number) {
  const from = toDateKey(new Date(year, monthIndex, 1));
  const to = toDateKey(new Date(year, monthIndex + 1, 0));
  return { from, to };
}

export function adjacentMonths(year: number, monthIndex: number) {
  const previous = new Date(year, monthIndex - 1, 1);
  const next = new Date(year, monthIndex + 1, 1);
  const current = new Date();
  return {
    previous: toMonthKey(previous),
    next: toMonthKey(next),
    current: toMonthKey(current),
  };
}

export function buildMonthGrid(year: number, monthIndex: number): CalendarDay[] {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: toDateKey(date),
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
  });
}

export function formatMonthTitle(year: number, monthIndex: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
