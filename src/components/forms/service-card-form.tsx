"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { createServiceCardAction } from "@/app/(app)/servicos/actions";
import { serviceCardSchema, type ServiceCardFormValues } from "@/lib/schemas";
import type { Client, ServiceColumn } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ServiceCardForm({
  clients,
  columns,
}: {
  clients: Client[];
  columns: ServiceColumn[];
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ServiceCardFormValues>({
    resolver: zodResolver(serviceCardSchema),
    defaultValues: {
      column_id: columns[0]?.id ?? "",
      client_id: "",
      title: "",
      description: "",
      priority: "medium",
      due_date: "",
      custom_fields_json: "{}",
    },
  });

  function submit(values: ServiceCardFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );
    startTransition(() => {
      void createServiceCardAction(formData);
      form.reset({ ...values, title: "", description: "", custom_fields_json: "{}" });
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <div className="space-y-2">
        <Label htmlFor="service-column">Coluna</Label>
        <select
          id="service-column"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          {...form.register("column_id")}
        >
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-client">Cliente</Label>
        <select
          id="service-client"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          {...form.register("client_id")}
        >
          <option value="">Sem cliente vinculado</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-title">Titulo</Label>
        <Input id="service-title" {...form.register("title")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-description">Descricao</Label>
        <Textarea id="service-description" {...form.register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service-priority">Prioridade</Label>
          <select
            id="service-priority"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("priority")}
          >
            <option value="low">Baixa</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-due-date">Data prevista</Label>
          <Input id="service-due-date" type="date" {...form.register("due_date")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-fields">Campos customizados JSON</Label>
        <Textarea id="custom-fields" {...form.register("custom_fields_json")} />
        {form.formState.errors.custom_fields_json ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.custom_fields_json.message?.toString()}
          </p>
        ) : null}
      </div>

      <Button disabled={pending || !columns.length}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Criar card
      </Button>
    </form>
  );
}
