"use client";

import type { ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  X,
} from "lucide-react";
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

type QuickReminder = {
  id: string;
  title: string;
  description: string | null;
  reminder_date: string;
  reminder_time: string | null;
  notification_preference: "due" | "10m" | "1h" | "none";
  completed_at: string | null;
};

type QuickReminderMember = {
  id: string;
  label: string;
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
  const [activeTab, setActiveTab] = useState<"task" | "reminder">("task");
  const [reminders, setReminders] = useState<QuickReminder[]>([]);
  const [members, setMembers] = useState<QuickReminderMember[]>([]);
  const [title, setTitle] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState(todayDate());
  const [reminderTime, setReminderTime] = useState("");
  const [reminderRecipientId, setReminderRecipientId] = useState("");
  const [notificationPreference, setNotificationPreference] = useState<"due" | "10m" | "1h" | "none">("due");
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyChecklistItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState(todayDate());
  const [editEmergency, setEditEmergency] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedDate = useMemo(() => {
    if (dateMode === "today") return todayDate();
    if (dateMode === "yesterday") return offsetDate(-1);
    return customDate;
  }, [dateMode, customDate]);

  useEffect(() => {
    setReminderDate(selectedDate);
  }, [selectedDate]);

  const loadItems = useCallback(async (date: string) => {
    setError(null);
    const response = await fetch(`/api/daily-checklist?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as ChecklistResponse | null;
    if (!response.ok || data?.error) {
      setError(data?.error ?? "Nao foi possivel carregar o checklist.");
      return;
    }
    setItems(sortChecklistItems(data?.items ?? []));
    onCountsChanged?.();
  }, [onCountsChanged]);

  useEffect(() => {
    if (!open) return;
    void loadItems(selectedDate);
  }, [loadItems, open, selectedDate]);

  const loadReminders = useCallback(async (date: string) => {
    setError(null);
    const response = await fetch(`/api/reminders/quick?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as {
      reminders?: QuickReminder[];
      members?: QuickReminderMember[];
      error?: string;
    } | null;
    if (!response.ok || data?.error) {
      setError(data?.error ?? "Nao foi possivel carregar lembretes.");
      return;
    }
    setReminders(data?.reminders ?? []);
    setMembers(data?.members ?? []);
    setReminderRecipientId((current) => current || data?.members?.[0]?.id || "");
  }, []);

  useEffect(() => {
    if (!open || activeTab !== "reminder") return;
    void loadReminders(selectedDate);
  }, [activeTab, loadReminders, open, selectedDate]);

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
        setItems((current) => sortChecklistItems([...current, data.item!]));
        setTitle("");
        setIsEmergency(false);
        onCountsChanged?.();
      })();
    });
  }

  async function updateItem(
    item: DailyChecklistItem,
    update: {
      status?: "open" | "done";
      isEmergency?: boolean;
      title?: string;
      description?: string | null;
      dueDate?: string;
    },
  ) {
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
    setEditingItem(null);
    onCountsChanged?.();
  }

  function startEdit(item: DailyChecklistItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditDate(item.due_date ?? selectedDate);
    setEditEmergency(item.is_emergency);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem || !editTitle.trim()) return;
    void updateItem(editingItem, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      dueDate: editDate,
      isEmergency: editEmergency,
    });
  }

  async function deleteItem(item: DailyChecklistItem) {
    const confirmed = window.confirm("Apagar este item da tarefa?");
    if (!confirmed) return;
    const response = await fetch(`/api/daily-checklist/${item.id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as ChecklistResponse | null;
    if (!response.ok || data?.error) {
      setError(data?.error ?? "Nao foi possivel apagar o item.");
      return;
    }
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    onCountsChanged?.();
  }

  function addReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reminderTitle.trim() || pending) return;
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/reminders/quick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            title: reminderTitle.trim(),
            date: reminderDate,
            time: reminderTime || null,
            recipientUserIds: reminderRecipientId ? [reminderRecipientId] : undefined,
            notificationPreference,
          }),
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok || data?.error) {
          setError(data?.error ?? "Nao foi possivel criar o lembrete.");
          return;
        }
        setReminderTitle("");
        setReminderTime("");
        setNotificationPreference("due");
        setReminderFormOpen(false);
        window.dispatchEvent(new Event("geogestao:notifications-refresh"));
        await loadReminders(selectedDate);
      })();
    });
  }

  async function reorderItems(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const from = items.findIndex((item) => item.id === activeId);
    const to = items.findIndex((item) => item.id === overId);
    if (from < 0 || to < 0) return;

    const next = moveArrayItem(items, from, to);
    setItems(next);
    const response = await fetch("/api/daily-checklist/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ itemIds: next.map((item) => item.id) }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok || data?.error) {
      setError(data?.error ?? "Nao foi possivel salvar a ordem.");
      await loadItems(selectedDate);
      return;
    }
    onCountsChanged?.();
  }

  return (
    <div className="relative flex flex-col items-end gap-3">
      {open ? (
        <section
          className="flex h-[min(560px,calc(100vh-9rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
          data-testid="daily-checklist-panel"
          aria-label="Tarefa"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold">Tarefa</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar tarefa" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="grid grid-cols-2 gap-2 border-b p-3">
            <Button type="button" size="sm" variant={activeTab === "task" ? "default" : "outline"} onClick={() => setActiveTab("task")}>
              <CalendarCheck aria-hidden="true" />
              Tarefa
            </Button>
            <Button type="button" size="sm" variant={activeTab === "reminder" ? "default" : "outline"} onClick={() => setActiveTab("reminder")}>
              <Bell aria-hidden="true" />
              Lembrete
            </Button>
          </div>

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
            {activeTab === "task" ? (
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
            ) : (
              <div className="relative">
                <Button type="button" size="sm" className="w-full" onClick={() => setReminderFormOpen((current) => !current)}>
                  <Plus aria-hidden="true" />
                  Adicionar lembrete
                </Button>
                {reminderFormOpen ? (
                  <form className="absolute right-0 top-11 z-20 grid w-full gap-2 rounded-lg border bg-card p-3 shadow-xl" onSubmit={addReminder}>
                    <input
                      value={reminderTitle}
                      onChange={(event) => setReminderTitle(event.target.value)}
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Titulo do lembrete"
                      maxLength={180}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={(event) => setReminderDate(event.target.value)}
                        className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <input
                        type="time"
                        value={reminderTime}
                        onChange={(event) => setReminderTime(event.target.value)}
                        className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <select
                      value={reminderRecipientId}
                      onChange={(event) => setReminderRecipientId(event.target.value)}
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <select
                      value={notificationPreference}
                      onChange={(event) => setNotificationPreference(event.target.value as "due" | "10m" | "1h" | "none")}
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Notifique-me"
                    >
                      <option value="due">Na data final</option>
                      <option value="10m">10 minutos antes</option>
                      <option value="1h">1 hora antes</option>
                      <option value="none">Nao notificar</option>
                    </select>
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setReminderFormOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" disabled={pending || !reminderTitle.trim()}>
                        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                        Adicionar lembrete
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {error ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
            {activeTab === "reminder" ? (
              reminders.length ? (
                reminders.map((reminder) => (
                  <div key={reminder.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{reminder.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reminder.reminder_date}
                      {reminder.reminder_time ? ` as ${reminder.reminder_time.slice(0, 5)}` : ""}
                      {" - "}
                      {reminder.notification_preference === "none" ? "sem notificacao" : "com notificacao"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">Nenhum lembrete para esta data.</p>
              )
            ) : items.length ? (
              <DndContext onDragEnd={reorderItems}>
                <div className="space-y-2">
                  {items.map((item) => (
                    <TaskDragShell key={item.id} item={item} disabled={editingItem?.id === item.id}>
                      {editingItem?.id === item.id ? (
                        <form className="grid gap-2" onSubmit={submitEdit}>
                          <input
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            maxLength={240}
                            aria-label="Titulo do item"
                          />
                          <textarea
                            value={editDescription}
                            onChange={(event) => setEditDescription(event.target.value)}
                            className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            maxLength={1000}
                            placeholder="Descricao"
                          />
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input
                              type="date"
                              value={editDate}
                              onChange={(event) => setEditDate(event.target.value)}
                              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant={editEmergency ? "destructive" : "outline"}
                              onClick={() => setEditEmergency((current) => !current)}
                            >
                              <AlertTriangle aria-hidden="true" />
                            </Button>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingItem(null)}>
                              Cancelar
                            </Button>
                            <Button type="submit" size="sm" disabled={!editTitle.trim()}>
                              Salvar
                            </Button>
                          </div>
                        </form>
                      ) : (
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
                              {item.completed_at ? ` - concluido ${new Date(item.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                            </p>
                            {item.source === "owner_assignment" ? (
                              <p className="mt-1 text-xs text-muted-foreground">Atribuido pelo proprietario da empresa</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button type="button" size="icon" variant="ghost" aria-label="Editar item" onClick={() => startEdit(item)}>
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button type="button" size="icon" variant={item.is_emergency ? "destructive" : "ghost"} aria-label="Alternar emergencia" onClick={() => updateItem(item, { isEmergency: !item.is_emergency })}>
                              <AlertTriangle aria-hidden="true" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" aria-label="Apagar item" onClick={() => deleteItem(item)}>
                              <X aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </TaskDragShell>
                  ))}
                </div>
              </DndContext>
            ) : (
              <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">Nenhum item para esta data.</p>
            )}
          </div>
        </section>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="relative size-11 rounded-full shadow-lg"
        aria-label={open ? "Minimizar tarefa" : "Abrir tarefa"}
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

function TaskDragShell({
  item,
  children,
  disabled,
}: {
  item: DailyChecklistItem;
  children: ReactNode;
  disabled?: boolean;
}) {
  const draggable = useDraggable({ id: item.id, disabled });
  const droppable = useDroppable({ id: item.id });
  const style = draggable.transform
    ? { transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      style={style}
      className={cn(
        "rounded-md border p-3 text-sm transition",
        item.is_emergency && "border-destructive bg-destructive/10",
        item.status === "done" && "opacity-70",
        droppable.isOver && "border-primary bg-primary/5",
        draggable.isDragging && "opacity-70 shadow-soft",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab rounded p-1 text-muted-foreground hover:text-primary active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
          aria-label="Arrastar item"
          disabled={disabled}
          {...draggable.listeners}
          {...draggable.attributes}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function sortChecklistItems(items: DailyChecklistItem[]) {
  return [...items].sort((left, right) => {
    const leftOrder = Number(left.sort_order ?? 0);
    const rightOrder = Number(right.sort_order ?? 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return Date.parse(left.created_at) - Date.parse(right.created_at);
  });
}

function moveArrayItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(amount: number) {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}
