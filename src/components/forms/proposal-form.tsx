"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { createProposalAction } from "@/app/(app)/propostas/actions";
import { proposalSchema, type ProposalFormValues } from "@/lib/schemas";
import type { Client } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProposalForm({ clients }: { clients: Client[] }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      client_id: clients[0]?.id ?? "",
      title: "",
      description: "",
      value: null,
      sent_at: "",
      valid_until: "",
      comments: "",
    },
  });

  function submit(values: ProposalFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );
    startTransition(() => {
      void createProposalAction(formData);
      form.reset({ ...values, title: "", description: "", value: null, comments: "" });
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <div className="space-y-2">
        <Label htmlFor="proposal-client">Cliente</Label>
        <select
          id="proposal-client"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          {...form.register("client_id")}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-title">Titulo</Label>
        <Input id="proposal-title" {...form.register("title")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-description">Descricao</Label>
        <Textarea id="proposal-description" {...form.register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="proposal-value">Valor</Label>
          <Input id="proposal-value" type="number" step="0.01" {...form.register("value")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sent-at">Envio</Label>
          <Input id="sent-at" type="date" {...form.register("sent_at")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid-until">Validade</Label>
          <Input id="valid-until" type="date" {...form.register("valid_until")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-comments">Comentarios</Label>
        <Textarea id="proposal-comments" {...form.register("comments")} />
      </div>

      <Button disabled={pending || !clients.length}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Criar proposta
      </Button>
    </form>
  );
}
