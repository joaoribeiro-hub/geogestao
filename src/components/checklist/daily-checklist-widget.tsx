"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DailyChecklistItem } from "@/types/database";

type ChecklistResponse = {
  items?: DailyChecklistItem[];
  item?: DailyChecklistItem;
  error?: string;
};

type ChecklistBadgeCounts = {
  openCount: number;
  ownerAssignedOpenCount: number;
};

export function DailyChecklistWidget({
  counts,
  onCountsChanged,
}: {
  counts?: ChecklistBadgeCounts;
  onCountsChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState(todayDate());
  const [items, setItems] = useState<DailyChecklistItem[]>([]);
  const [title, setTitle] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedDate = useMemo(() => {
    if (dateMode === "today") return todayDate();
    if (dateMode === "yesterday") return offsetDate(-1);
    return customDate;
  }, [dateMode, customDate]);

  const loadItems = useCallback(async (date: string) => {
    setError(null);
    const response = await fetch(`/api/daily-checklist?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as ChecklistResponse | null;
    if (!response.ok || data?.error) {
      setError(data?.error ?? "Nao foi possivel carregar o checklist.");
      return;
    }
    setItems(data?.items ?? []);
    onCountsChanged?.();
  }, [onCountsChanged]);

  useEffect(() => {
    if (!open) return;
    void loadItems(selectedDate);
  }, [loadItems, open, selectedDate]);

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || pending) return;
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/daily-checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ title: title.trim(), date: selectedDate, isEmergency }),
        });
        const data = (await response.json().catch(() => null)) as ChecklistResponse | null;
        if (!response.ok || data?.error || !data?.item) {
          setError(data?.error ?? "Nao foi possivel adicionar o item.");
          return;
        }
        setItems((current) => [...current, data.item!]);
        setTitle("");
        setIsEmergency(false);
        onCountsChanged?.();
      })();
    });
  }

  async function updateItem(item: DailyChecklistItem, update: { status?: "open" | "done"; isEmergency?: boolean }) {
    const response = await fetch(`/api/daily-checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(update),
    });
    const data = (await response.json().catch(() => null)) as ChecklistResponse | null;
    if (!response.ok || data?.error || !data?.item) {
      setError(data?.error ?? "Nao foi possivel atualizar o item.");
      return;
    }
    setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? data.item! : currentItem)));
    onCountsChanged?.();
  }

  return (
    <div className="fixed bottom-40 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-20 lg:right-6">
      {open ? (
        <section
          className="flex h-[min(560px,calc(100vh-9rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
          data-testid="daily-checklist-panel"
          aria-label="Checklist de hoje"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold">Checklist de hoje</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar checklist" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="space-y-3 border-b p-3">
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" size="sm" variant={dateMode === "today" ? "default" : "outline"} onClick={() => setDateMode("today")}>Hoje</Button>
              <Button type="button" size="sm" variant={dateMode === "yesterday" ? "default" : "outline"} onClick={() => setDateMode("yesterday")}>Ontem</Button>
              <Button type="button" size="sm" variant={dateMode === "custom" ? "default" : "outline"} onClick={() => setDateMode("custom")}>Data</Button>
            </div>
            {dateMode === "custom" ? (
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : null}
            <form className="grid gap-2" onSubmit={addItem}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Adicionar item"
                maxLength={240}
              />
              <div className="flex items-center justify-between gap-2">
                <Button type="button" size="sm" variant={isEmergency ? "destructive" : "outline"} onClick={() => setIsEmergency((current) => !current)}>
                  <AlertTriangle aria-hidden="true" />
                  Emergencia
                </Button>
                <Button type="submit" size="sm" disabled={pending || !title.trim()}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  Adicionar
                </Button>
              </div>
            </form>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {error ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
            {items.length ? (
              items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    item.is_emergency && "border-destructive bg-destructive/10",
                    item.status === "done" && "opacity-70",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="mt-0.5 text-muted-foreground hover:text-primary"
                      onClick={() => updateItem(item, { status: item.status === "done" ? "open" : "done" })}
                      aria-label={item.status === "done" ? "Reabrir item" : "Concluir item"}
                    >
                      <CheckCircle2 className={cn("size-5", item.status === "done" && "fill-primary text-primary")} aria-hidden="true" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium", item.status === "done" && "line-through")}>{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Criado {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {item.completed_at ? ` · concluido ${new Date(item.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </p>
                      {item.source === "owner_assignment" ? (
                        <p className="mt-1 text-xs text-muted-foreground">Atribuido pelo proprietario da empresa</p>
                      ) : null}
                    </div>
                    <Button type="button" size="sm" variant={item.is_emergency ? "destructive" : "ghost"} onClick={() => updateItem(item, { isEmergency: !item.is_emergency })}>
                      <AlertTriangle aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">Nenhum item para esta data.</p>
            )}
          </div>
        </section>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="relative size-12 rounded-full shadow-lg"
        aria-label={open ? "Minimizar checklist" : "Abrir checklist de hoje"}
        onClick={() => setOpen((current) => !current)}
        data-testid="daily-checklist-button"
      >
        {counts?.ownerAssignedOpenCount ? (
          <span
            className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground"
            data-testid="daily-checklist-owner-badge"
          >
            {counts.ownerAssignedOpenCount}
          </span>
        ) : null}
        {counts?.openCount ? (
          <span
            className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white"
            data-testid="daily-checklist-open-badge"
          >
            {counts.openCount}
          </span>
        ) : null}
        {open ? <X aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}
      </Button>
    </div>
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(amount: number) {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}
