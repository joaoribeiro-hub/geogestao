"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarPlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import {
  createAgendaReminderAction,
  deleteAgendaReminderAction,
  updateAgendaReminderAction,
} from "@/app/(app)/agenda/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarDay } from "@/lib/agenda/calendar";
import { cn, formatDate } from "@/lib/utils";

export type AgendaEvent = {
  id: string;
  date: string;
  type: "Servico" | "Prazo" | "Lembrete" | "Cliente" | "Etapa" | "Feriado";
  title: string;
  time?: string | null;
  description?: string | null;
  href?: string | null;
  category?: string | null;
  customCategory?: string | null;
  recurrence?: "none" | "weekly" | null;
  reminderId?: string | null;
  createdBy?: string | null;
};

export function AgendaCalendar({
  days,
  events,
  members,
  currentUserId,
  canUseSpecialCategories = false,
}: {
  days: CalendarDay[];
  events: AgendaEvent[];
  members: Array<{ id: string; label: string }>;
  currentUserId: string;
  canUseSpecialCategories?: boolean;
}) {
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [reminderDate, setReminderDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [pending, startTransition] = useTransition();
  const eventsByDate = events.reduce<Record<string, AgendaEvent[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] ?? []), event];
    return acc;
  }, {});

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b bg-secondary text-center text-xs font-medium text-muted-foreground">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
                <div key={day} className="px-2 py-1.5">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsByDate[day.date] ?? [];
            return (
              <button
                key={day.date}
                type="button"
                className={cn(
                  "min-h-24 border-b border-r bg-background p-1.5 text-left align-top transition hover:bg-secondary/60",
                  !day.inMonth && "bg-muted/30 text-muted-foreground",
                )}
                onClick={() => setReminderDate(day.date)}
              >
                <span className="text-xs font-semibold">{day.dayNumber}</span>
                <div className="mt-1 max-h-20 space-y-1 overflow-y-auto">
                  {dayEvents.slice(0, 5).map((event) => (
                    <span
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "block rounded px-1.5 py-0.5 text-[11px] font-medium leading-snug",
                        event.type === "Prazo" && "bg-destructive/10 text-destructive",
                        event.type === "Servico" && "bg-primary/10 text-primary",
                        event.type === "Etapa" && "bg-emerald-100 text-emerald-800",
                        event.type === "Feriado" && "bg-violet-100 text-violet-800",
                        event.type === "Lembrete" && categoryClass(event.category),
                        event.type === "Cliente" && "bg-sky-100 text-sky-800",
                      )}
                      onClick={(mouseEvent) => {
                        mouseEvent.stopPropagation();
                        setSelectedEvent(event);
                      }}
                    >
                      {event.time ? `${event.time} · ` : ""}{event.type}: {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 5 ? (
                    <span className="block text-xs text-muted-foreground">+{dayEvents.length - 5} itens</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Button type="button" onClick={() => setReminderDate(new Date().toISOString().slice(0, 10))}>
        <CalendarPlus aria-hidden="true" />
        Adicionar lembrete
      </Button>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{selectedEvent.type}</p>
                <h2 className="text-lg font-semibold">{selectedEvent.title}</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedEvent(null)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {formatDate(selectedEvent.date)} {selectedEvent.time ?? ""}
            </p>
            {selectedEvent.description ? <p className="mt-3 text-sm">{selectedEvent.description}</p> : null}
            {selectedEvent.href ? (
              <Button asChild className="mt-4">
                <Link href={selectedEvent.href}>Abrir registro</Link>
              </Button>
            ) : null}
            {selectedEvent.reminderId && selectedEvent.createdBy === currentUserId ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingEvent(selectedEvent);
                    setSelectedEvent(null);
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => {
                      void (async () => {
                        if (selectedEvent.reminderId && window.confirm("Apagar este lembrete?")) {
                          await deleteAgendaReminderAction(selectedEvent.reminderId);
                          window.dispatchEvent(new Event("geogestao:notifications-refresh"));
                          setSelectedEvent(null);
                        }
                      })();
                    })
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Apagar
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {reminderDate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4">
          <form
            className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(() => {
                void (async () => {
                  await createAgendaReminderAction(formData);
                  window.dispatchEvent(new Event("geogestao:notifications-refresh"));
                  setReminderDate(null);
                })();
              });
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Adicionar lembrete</h2>
                <p className="text-sm text-muted-foreground">{formatDate(reminderDate)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setReminderDate(null)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="space-y-3">
              <Field label="Titulo" name="title" required />
              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea name="description" />
              </div>
              <Input type="hidden" name="reminder_date" value={reminderDate} readOnly />
              <Field label="Horario" name="reminder_time" type="time" />
              <CategoryFields canUseSpecialCategories={canUseSpecialCategories} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recurrence" value="weekly" />
                Repetir semanalmente
              </label>
              <div className="space-y-2">
                <Label>Quem recebe</Label>
                <select
                  name="recipient_user_ids"
                  multiple
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={[currentUserId]}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
                Salvar lembrete
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {editingEvent ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4">
          <form
            className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              if (!formData.get("recurrence")) formData.set("recurrence", "none");
              startTransition(() => {
                void (async () => {
                  if (editingEvent.reminderId) {
                    await updateAgendaReminderAction(editingEvent.reminderId, formData);
                    window.dispatchEvent(new Event("geogestao:notifications-refresh"));
                    setEditingEvent(null);
                  }
                })();
              });
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Editar lembrete</h2>
                <p className="text-sm text-muted-foreground">{formatDate(editingEvent.date)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setEditingEvent(null)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="space-y-3">
              <Field label="Titulo" name="title" required defaultValue={editingEvent.title} />
              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea name="description" defaultValue={editingEvent.description ?? ""} />
              </div>
              <Field label="Data" name="reminder_date" type="date" required defaultValue={editingEvent.date} />
              <Field label="Horario" name="reminder_time" type="time" defaultValue={editingEvent.time ?? ""} />
              <CategoryFields
                canUseSpecialCategories={canUseSpecialCategories}
                defaultCategory={editingEvent.category ?? "Outro"}
                defaultCustomCategory={editingEvent.customCategory ?? ""}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="recurrence"
                  value="weekly"
                  defaultChecked={editingEvent.recurrence === "weekly"}
                />
                Repetir semanalmente
              </label>
              <div className="space-y-2">
                <Label>Quem recebe</Label>
                <select
                  name="recipient_user_ids"
                  multiple
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={[currentUserId]}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                Salvar alteracoes
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input name={name} type={type} required={required} defaultValue={defaultValue} />
    </div>
  );
}

function CategoryFields({
  canUseSpecialCategories,
  defaultCategory = "Outro",
  defaultCustomCategory = "",
}: {
  canUseSpecialCategories: boolean;
  defaultCategory?: string;
  defaultCustomCategory?: string;
}) {
  const categories = [
    "Reuniao interna",
    "Reuniao com clientes",
    "Servicos",
    "Outro",
    ...(canUseSpecialCategories ? ["Comercial", "Financeiro", "Marketing", "R.H"] : []),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Categoria</Label>
        <select
          name="category"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={defaultCategory}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <Field label="Categoria personalizada" name="custom_category" defaultValue={defaultCustomCategory} />
    </div>
  );
}

function categoryClass(category?: string | null) {
  switch (category) {
    case "Reuniao interna":
      return "bg-yellow-100 text-yellow-900";
    case "Reuniao com clientes":
      return "bg-blue-100 text-blue-900";
    case "Comercial":
      return "bg-violet-100 text-violet-900";
    case "Financeiro":
      return "bg-emerald-100 text-emerald-900";
    case "Marketing":
      return "bg-pink-100 text-pink-900";
    case "R.H":
      return "bg-orange-100 text-orange-900";
    case "Servicos":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-foreground";
  }
}
