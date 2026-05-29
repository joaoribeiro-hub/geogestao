"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createChecklistAction,
  createChecklistItemAction,
  deleteChecklistItemAction,
  toggleChecklistItemAction,
} from "@/app/(app)/servicos/actions";
import { formatDate } from "@/lib/utils";
import { checklistItemSchema, checklistSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChecklistValues = { service_card_id: string; title: string };
type ItemValues = {
  checklist_id: string;
  title: string;
  is_done?: boolean;
  due_date?: string | null;
  due_time?: string | null;
};

export function ChecklistForm({ serviceCardId }: { serviceCardId: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ChecklistValues>({
    resolver: zodResolver(checklistSchema),
    defaultValues: { service_card_id: serviceCardId, title: "" },
  });

  function submit(values: ChecklistValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.set(key, value));
    startTransition(() => {
      void createChecklistAction(formData);
      form.reset({ service_card_id: serviceCardId, title: "" });
    });
  }

  return (
    <form className="flex gap-2" onSubmit={form.handleSubmit(submit)}>
      <input type="hidden" {...form.register("service_card_id")} />
      <Input placeholder="Novo checklist" {...form.register("title")} />
      <Button size="icon" disabled={pending} title="Adicionar checklist">
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
      </Button>
    </form>
  );
}

export function ChecklistItemForm({
  checklistId,
  allowSchedule = false,
}: {
  checklistId: string;
  allowSchedule?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ItemValues>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      checklist_id: checklistId,
      title: "",
      is_done: false,
      due_date: "",
      due_time: "",
    },
  });

  function submit(values: ItemValues) {
    const formData = new FormData();
    formData.set("checklist_id", values.checklist_id);
    formData.set("title", values.title);
    formData.set("is_done", values.is_done ? "true" : "false");
    if (allowSchedule) {
      formData.set("due_date", values.due_date ?? "");
      formData.set("due_time", values.due_time ?? "");
    }
    startTransition(() => {
      void createChecklistItemAction(formData);
      form.reset({
        checklist_id: checklistId,
        title: "",
        is_done: false,
        due_date: "",
        due_time: "",
      });
    });
  }

  return (
    <form
      className={allowSchedule ? "grid gap-2 sm:grid-cols-[1fr_9rem_7rem_auto]" : "flex gap-2"}
      onSubmit={form.handleSubmit(submit)}
    >
      <input type="hidden" {...form.register("checklist_id")} />
      <Input placeholder="Novo item" {...form.register("title")} />
      {allowSchedule ? (
        <>
          <Input type="date" aria-label="Data da etapa" {...form.register("due_date")} />
          <Input type="time" aria-label="Horario da etapa" {...form.register("due_time")} />
        </>
      ) : null}
      <Button size="icon" variant="outline" disabled={pending} title="Adicionar item">
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
      </Button>
    </form>
  );
}

export function ChecklistToggle({
  itemId,
  checklistId,
  checked,
  label,
  createdAt,
  completedAt,
  dueDate,
  dueTime,
  canDelete = false,
}: {
  itemId: string;
  checklistId: string;
  checked: boolean;
  label: string;
  createdAt?: string | null;
  completedAt?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  canDelete?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
      <Label className="flex flex-1 cursor-pointer items-start gap-3">
        <input
          className="mt-1"
          type="checkbox"
          defaultChecked={checked}
          disabled={pending}
          onChange={(event) =>
            startTransition(() => {
              void toggleChecklistItemAction(itemId, checklistId, event.target.checked);
            })
          }
        />
        <span>
          <span className={checked ? "block text-muted-foreground line-through" : "block"}>{label}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Criado em {formatDate(createdAt)}
            {completedAt ? ` · concluido em ${formatDate(completedAt)}` : ""}
            {dueDate
              ? ` · etapa em ${formatDate(dueDate)}${dueTime ? ` as ${dueTime.slice(0, 5)}` : ""}`
              : ""}
          </span>
        </span>
      </Label>
      {canDelete ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-destructive"
          disabled={pending}
          title="Apagar item"
          onClick={() =>
            startTransition(() => {
              if (window.confirm("Apagar este item do checklist?")) {
                void deleteChecklistItemAction(itemId, checklistId);
              }
            })
          }
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
