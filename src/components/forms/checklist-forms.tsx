"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createChecklistAction,
  createChecklistItemAction,
  toggleChecklistItemAction,
} from "@/app/(app)/servicos/actions";
import { checklistItemSchema, checklistSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChecklistValues = { service_card_id: string; title: string };
type ItemValues = { checklist_id: string; title: string; is_done?: boolean };

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

export function ChecklistItemForm({ checklistId }: { checklistId: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ItemValues>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: { checklist_id: checklistId, title: "", is_done: false },
  });

  function submit(values: ItemValues) {
    const formData = new FormData();
    formData.set("checklist_id", values.checklist_id);
    formData.set("title", values.title);
    formData.set("is_done", values.is_done ? "true" : "false");
    startTransition(() => {
      void createChecklistItemAction(formData);
      form.reset({ checklist_id: checklistId, title: "", is_done: false });
    });
  }

  return (
    <form className="flex gap-2" onSubmit={form.handleSubmit(submit)}>
      <input type="hidden" {...form.register("checklist_id")} />
      <Input placeholder="Novo item" {...form.register("title")} />
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
}: {
  itemId: string;
  checklistId: string;
  checked: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Label className="flex cursor-pointer items-center gap-3 rounded-md border bg-background p-3 text-sm">
      <input
        type="checkbox"
        defaultChecked={checked}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => {
            void toggleChecklistItemAction(itemId, checklistId, event.target.checked);
          })
        }
      />
      <span className={checked ? "text-muted-foreground line-through" : ""}>{label}</span>
    </Label>
  );
}
