import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adjacentMonths,
  buildMonthGrid,
  formatMonthTitle,
  parseMonthParam,
} from "@/lib/agenda/calendar";
import { cn, formatDate } from "@/lib/utils";

type ScheduleEvent = {
  id: string;
  date: string;
  title: string;
  type: "Inicio" | "Prazo" | "Etapa";
  href: string;
};

export function ServiceSchedule({
  month,
  events,
}: {
  month?: string;
  events: ScheduleEvent[];
}) {
  const monthData = parseMonthParam(month);
  const nav = adjacentMonths(monthData.year, monthData.monthIndex);
  const days = buildMonthGrid(monthData.year, monthData.monthIndex);
  const eventsByDate = events.reduce<Record<string, ScheduleEvent[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] ?? []), event];
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Cronograma dos servicos</CardTitle>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {formatMonthTitle(monthData.year, monthData.monthIndex)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/servicos?scheduleMonth=${nav.previous}`}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Anterior
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/servicos?scheduleMonth=${nav.current}`}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Mes atual
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/servicos?scheduleMonth=${nav.next}`}>
              Proximo
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-7 border-b bg-secondary text-center text-xs font-medium text-muted-foreground">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
              <div key={day} className="px-2 py-1.5">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-7">
            {days.map((day) => {
              const dayEvents = eventsByDate[day.date] ?? [];
              return (
                <div
                  key={day.date}
                  className={cn(
                    "min-h-20 border-b border-r bg-background p-1.5",
                    !day.inMonth && "bg-muted/30 text-muted-foreground",
                  )}
                >
                  <p className="text-xs font-semibold">{day.dayNumber}</p>
                  <div className="mt-1 max-h-16 space-y-1 overflow-y-auto">
                    {dayEvents.map((event) => (
                      <Link
                        key={event.id}
                        href={event.href}
                        className={cn(
                          "block rounded px-1.5 py-0.5 text-[11px] font-medium leading-snug",
                          event.type === "Inicio" && "bg-primary/10 text-primary",
                          event.type === "Prazo" && "bg-destructive/10 text-destructive",
                          event.type === "Etapa" && "bg-emerald-100 text-emerald-800",
                        )}
                        title={`${event.type}: ${event.title} - ${formatDate(event.date)}`}
                      >
                        {event.type}: {event.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
