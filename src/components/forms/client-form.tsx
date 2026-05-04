"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createClientAction,
  updateClientAction,
} from "@/app/(app)/clientes/actions";
import { clientSchema, type ClientFormValues } from "@/lib/schemas";
import type { Client } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ClientForm({ client }: { client?: Client }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      kind: client?.kind ?? "pf",
      name: client?.name ?? "",
      document: client?.document ?? "",
      email: client?.email ?? "",
      phone: client?.phone ?? "",
      address: client?.address ?? "",
      notes: client?.notes ?? "",
    },
  });

  function submit(values: ClientFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );

    startTransition(() => {
      void (client
        ? updateClientAction(client.id, formData)
        : createClientAction(formData));
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">Tipo</Label>
          <select
            id="kind"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("kind")}
          >
            <option value="pf">Pessoa fisica</option>
            <option value="pj">Pessoa juridica</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document">CPF/CNPJ</Label>
          <Input id="document" {...form.register("document")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" {...form.register("phone")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereco</Label>
        <Input id="address" {...form.register("address")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observacoes</Label>
        <Textarea id="notes" {...form.register("notes")} />
      </div>

      <Button disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
        {client ? "Salvar cliente" : "Criar cliente"}
      </Button>
    </form>
  );
}
