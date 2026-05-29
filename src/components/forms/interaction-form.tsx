"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { createInteractionAction } from "@/app/(app)/clientes/actions";
import { interactionSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  client_id: string;
  type: "ligacao" | "email" | "reuniao" | "whatsapp" | "nota";
  occurred_at: string;
  description: string;
};

export function InteractionForm({
  clientId,
  onSaved,
}: {
  clientId: string;
  onSaved?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      client_id: clientId,
      type: "whatsapp",
      occurred_at: new Date().toISOString().slice(0, 16),
      description: "",
    },
  });

  function submit(values: Values) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.set(key, value));
    startTransition(() => {
      void (async () => {
        await createInteractionAction(formData);
        window.dispatchEvent(new Event("geogestao:notifications-refresh"));
        form.reset({ ...values, description: "" });
        onSaved?.();
      })();
    });
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
      <input type="hidden" {...form.register("client_id")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <select
            id="type"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("type")}
          >
            <option value="ligacao">Ligacao</option>
            <option value="email">E-mail</option>
            <option value="reuniao">Reuniao</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="nota">Nota</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="occurred_at">Data</Label>
          <input
            id="occurred_at"
            type="datetime-local"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("occurred_at")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descricao</Label>
        <Textarea id="description" {...form.register("description")} />
      </div>
      <Button size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Registrar interacao
      </Button>
    </form>
  );
}
