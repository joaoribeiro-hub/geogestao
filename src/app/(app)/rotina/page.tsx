import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { createRoutineItemAction } from "@/app/(app)/rotina/actions";
import { RoutineItemToggle } from "@/components/routine/routine-item-toggle";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalDisclosure } from "@/components/ui/modal-disclosure";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function RoutinePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const start = weekStart(week ? new Date(`${week}T00:00:00-03:00`) : new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateKey(date);
  });
  const nav = {
    previous: shiftDateKey(days[0], -7),
    current: toDateKey(new Date()),
    next: shiftDateKey(days[0], 7),
  };

  const { data: routineItems } = await supabase
    .from("routine_items")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .is("archived_at", null)
    .neq("status", "canceled")
    .or(`and(routine_scope.eq.daily,routine_date.lte.${days[6]}),routine_scope.in.(weekly,monthly,annual)`)
    .order("created_at", { ascending: true });

  const items = routineItems ?? [];
  const dailyItems = items.filter((item) => item.routine_scope === "daily");
  const planningItems = items.filter((item) => item.routine_scope !== "daily");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Rotina"
          description="Planejamento semanal, mensal e anual sincronizado com o checklist diario."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/rotina?week=${nav.previous}`}>
              <ChevronLeft aria-hidden="true" />
              Semana anterior
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/rotina?week=${nav.current}`}>
              <RotateCcw aria-hidden="true" />
              Semana atual
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/rotina?week=${nav.next}`}>
              Proxima semana
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
          <ModalDisclosure
            title="Adicionar item de rotina"
            description="Crie uma tarefa diaria, semanal, mensal ou anual."
            trigger={<Button type="button">+ Adicionar item de rotina</Button>}
          >
            <form action={createRoutineItemAction} className="grid gap-3">
              <div className="space-y-2">
                <Label>Tarefa</Label>
                <Input name="title" required />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Escopo</Label>
                  <select name="routine_scope" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input name="routine_date" type="date" defaultValue={toDateKey(new Date())} />
                </div>
                <div className="space-y-2">
                  <Label>Horario</Label>
                  <Input name="due_time" type="time" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea name="description" rows={3} />
              </div>
              <Button>Adicionar</Button>
            </form>
          </ModalDisclosure>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const dayItems = dailyItems.filter((item) => {
            if (item.status === "open") return !item.routine_date || item.routine_date <= day;
            return item.routine_date === day || item.completed_at?.slice(0, 10) === day;
          });
          const isToday = day === toDateKey(new Date());
          return (
            <Card key={day} className={isToday ? "border-primary" : ""}>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">{formatDate(day)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {dayItems.length ? (
                  dayItems.map((item) => (
                    <RoutineItemToggle
                      key={item.id}
                      itemId={item.id}
                      checked={item.status === "done"}
                      label={item.title}
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Sem tarefas.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(["weekly", "monthly", "annual"] as const).map((scope) => (
          <Card key={scope}>
            <CardHeader>
              <CardTitle>
                {scope === "weekly" ? "Rotina Semanal" : scope === "monthly" ? "Rotina Mensal" : "Rotina Anual"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {planningItems.filter((item) => item.routine_scope === scope).length ? (
                planningItems
                  .filter((item) => item.routine_scope === scope)
                  .map((item) => (
                    <RoutineItemToggle
                      key={item.id}
                      itemId={item.id}
                      checked={item.status === "done"}
                      label={item.title}
                    />
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function weekStart(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

function shiftDateKey(value: string, days: number) {
  const date = new Date(`${value}T00:00:00-03:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
