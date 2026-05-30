"use client";

import { useState } from "react";
import { CalendarDays, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { periodLabel, periodOptions, type PeriodRange } from "@/lib/period";

export function PeriodFilter({
  range,
  action,
  preserveParams,
  compact = false,
}: {
  range: PeriodRange;
  action: string;
  preserveParams?: Record<string, string | null | undefined>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (compact) {
    return (
      <div className="relative mb-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)}>
          <Filter aria-hidden="true" />
          Filtro
        </Button>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          {periodLabel(range)}
        </span>
        {open ? (
          <div className="absolute top-12 z-20 w-[min(92vw,720px)] rounded-lg border bg-card p-4 shadow-xl">
            <FilterForm range={range} action={action} preserveParams={preserveParams} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <FilterForm range={range} action={action} preserveParams={preserveParams} showSummary />
      </CardContent>
    </Card>
  );
}

function FilterForm({
  range,
  action,
  preserveParams,
  showSummary = false,
}: {
  range: PeriodRange;
  action: string;
  preserveParams?: Record<string, string | null | undefined>;
  showSummary?: boolean;
}) {
  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="grid gap-3 md:grid-cols-[minmax(180px,240px)_1fr_1fr]">
        {Object.entries(preserveParams ?? {}).map(([key, value]) =>
          value ? <input key={key} name={key} type="hidden" value={value} /> : null,
        )}

        <div className="space-y-2">
          <Label htmlFor="period-filter">Periodo</Label>
          <select
            id="period-filter"
            name="period"
            defaultValue={range.period}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {periodOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period-from">Data inicial</Label>
          <Input id="period-from" name="from" type="date" defaultValue={range.from ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="period-to">Data final</Label>
          <Input id="period-to" name="to" type="date" defaultValue={range.to ?? ""} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showSummary ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            {periodLabel(range)}
          </span>
        ) : null}
        <Button type="submit">
          <Filter aria-hidden="true" />
          Aplicar
        </Button>
      </div>
    </form>
  );
}
