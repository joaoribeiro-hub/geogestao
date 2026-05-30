"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createChecklistAction,
  createChecklistItemAction,
  deleteChecklistItemAction,
  toggleChecklistItemAction,
  updateChecklistItemAction,
} from "@/app/(app)/servicos/actions";
import { formatDate } from "@/lib/utils";
import { checklistItemSchema, checklistSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalDisclosure } from "@/components/ui/modal-disclosure";

type ChecklistValues = { service_card_id: string; title: string };
type ItemValues = {
  checklist_id?: string;
  service_card_id?: string;
  checklist_type?: "documents" | "steps";
  title: string;
  is_done?: boolean;
  created_at?: string | null;
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
  serviceCardId,
  checklistType = "documents",
  allowSchedule = false,
}: {
  checklistId?: string;
  serviceCardId?: string;
  checklistType?: "documents" | "steps";
  allowSchedule?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ItemValues>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      checklist_id: checklistId,
      service_card_id: serviceCardId,
      checklist_type: checklistType,
      title: "",
      is_done: false,
      created_at: todayDate(),
      due_date: "",
      due_time: "",
    },
  });

  function submit(values: ItemValues) {
    const formData = new FormData();
    if (values.checklist_id) formData.set("checklist_id", values.checklist_id);
    if (values.service_card_id) formData.set("service_card_id", values.service_card_id);
    if (values.checklist_type) formData.set("checklist_type", values.checklist_type);
    formData.set("title", values.title);
    formData.set("is_done", values.is_done ? "true" : "false");
    formData.set("created_at", values.created_at ?? "");
    if (allowSchedule) {
      formData.set("due_date", values.due_date ?? "");
      formData.set("due_time", values.due_time ?? "");
    }
    startTransition(() => {
      void createChecklistItemAction(formData);
      form.reset({
        checklist_id: checklistId,
        service_card_id: serviceCardId,
        checklist_type: checklistType,
        title: "",
        is_done: false,
        created_at: todayDate(),
        due_date: "",
        due_time: "",
      });
    });
  }

  return (
    <ModalDisclosure
      title="Adicionar item"
      description="Inclua um item no checklist deste servico."
      trigger={<Button type="button" size="sm" variant="outline">+ Adicionar item</Button>}
    >
      <form className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
        {checklistId ? <input type="hidden" {...form.register("checklist_id")} /> : null}
        {serviceCardId ? <input type="hidden" {...form.register("service_card_id")} /> : null}
        <input type="hidden" {...form.register("checklist_type")} />
        <div className="space-y-2">
          <Label>Nome do item</Label>
          <Input placeholder="Novo item" {...form.register("title")} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Data de criacao</Label>
            <Input type="date" {...form.register("created_at")} />
          </div>
          <div className="space-y-2">
            <Label>Data de previsao</Label>
            <Input type="date" aria-label="Data de previsao" {...form.register("due_date")} />
          </div>
          <div className="space-y-2">
            <Label>Horario</Label>
            <Input type="time" aria-label="Horario de previsao" {...form.register("due_time")} />
          </div>
        </div>
        <Button disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          Adicionar
        </Button>
      </form>
    </ModalDisclosure>
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
  allowSchedule = false,
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
  allowSchedule?: boolean;
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
      <ChecklistItemEditButton
        itemId={itemId}
        checklistId={checklistId}
        label={label}
        dueDate={dueDate}
        dueTime={dueTime}
        allowSchedule={allowSchedule}
      />
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

function ChecklistItemEditButton({
  itemId,
  checklistId,
  label,
  dueDate,
  dueTime,
  allowSchedule,
}: {
  itemId: string;
  checklistId: string;
  label: string;
  dueDate?: string | null;
  dueTime?: string | null;
  allowSchedule: boolean;
}) {
  return (
    <ModalDisclosure
      title="Editar item"
      description="Atualize nome, data e horario do item."
      trigger={
        <Button type="button" size="icon" variant="ghost" className="size-8" title="Editar item">
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      }
    >
      <form action={updateChecklistItemAction} className="grid gap-3">
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="checklist_id" value={checklistId} />
        <div className="space-y-2">
          <Label>Nome do item</Label>
          <Input name="title" defaultValue={label} required />
        </div>
        {allowSchedule ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data de previsao</Label>
              <Input name="due_date" type="date" defaultValue={dueDate ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Horario</Label>
              <Input name="due_time" type="time" defaultValue={dueTime?.slice(0, 5) ?? ""} />
            </div>
          </div>
        ) : null}
        <Button>Salvar</Button>
      </form>
    </ModalDisclosure>
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
