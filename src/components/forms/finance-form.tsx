"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createExpenseAction,
  createRevenueAction,
  createTransferAction,
} from "@/app/(app)/financeiro/actions";
import {
  financeSchema,
  financeTransferSchema,
  type FinanceFormValues,
  type FinanceTransferFormValues,
} from "@/lib/schemas";
import type { Client, Proposal, ServiceCard } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FinanceForm({
  type,
  clients,
  proposals,
  serviceCards,
  onSaved,
}: {
  type: "revenue" | "expense";
  clients: Client[];
  proposals: Proposal[];
  serviceCards: ServiceCard[];
  onSaved?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<FinanceFormValues>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      client_id: type === "revenue" ? clients[0]?.id ?? "" : "",
      proposal_id: "",
      service_card_id: "",
      description: "",
      category: "",
      amount: 0,
      expected_amount: 0,
      realized_amount: null,
      due_date: new Date().toISOString().slice(0, 10),
      paid_at: "",
      bank_account: "",
      notes: "",
      status: "pending",
    },
  });

  function submit(values: FinanceFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );
    startTransition(() => {
      void (async () => {
        if (type === "revenue") {
          await createRevenueAction(formData);
        } else {
          await createExpenseAction(formData);
        }
        onSaved?.();
      })();
      form.reset({
        ...values,
        description: "",
        category: "",
        amount: 0,
        paid_at: "",
      });
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Cliente</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("client_id")}
          >
            {type === "expense" ? <option value="">Nao vincular</option> : null}
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Realizado?</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("status")}
          >
            <option value="pending">Nao</option>
            <option value="paid">Sim</option>
            <option value="overdue">Vencido</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Proposta</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("proposal_id")}
          >
            <option value="">Nao vincular</option>
            {proposals.map((proposal) => (
              <option key={proposal.id} value={proposal.id}>
                {proposal.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Card de servico</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("service_card_id")}
          >
            <option value="">Nao vincular</option>
            {serviceCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Descricao</Label>
          <Input {...form.register("description")} />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input {...form.register("category")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Valor previsto</Label>
          <Input type="number" step="0.01" {...form.register("amount")} />
        </div>
        <div className="space-y-2">
          <Label>Valor realizado</Label>
          <Input type="number" step="0.01" {...form.register("realized_amount")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Vencimento</Label>
          <Input type="date" {...form.register("due_date")} />
        </div>
        <div className="space-y-2">
          <Label>Pagamento</Label>
          <Input type="date" {...form.register("paid_at")} />
        </div>
        <div className="space-y-2">
          <Label>Banco/Conta</Label>
          <Input {...form.register("bank_account")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observacoes</Label>
        <Input {...form.register("notes")} />
      </div>

      <Button disabled={pending || (type === "revenue" && !clients.length)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {type === "revenue" ? "Criar entrada" : "Criar saida"}
      </Button>
    </form>
  );
}

export function TransferForm({ onSaved }: { onSaved?: () => void }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<FinanceTransferFormValues>({
    resolver: zodResolver(financeTransferSchema),
    defaultValues: {
      from_bank_account: "",
      to_bank_account: "",
      amount: 0,
      transfer_date: new Date().toISOString().slice(0, 10),
      description: "",
      notes: "",
    },
  });

  function submit(values: FinanceTransferFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );
    startTransition(() => {
      void (async () => {
        await createTransferAction(formData);
        onSaved?.();
      })();
      form.reset({
        from_bank_account: "",
        to_bank_account: "",
        amount: 0,
        transfer_date: new Date().toISOString().slice(0, 10),
        description: "",
        notes: "",
      });
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Banco/conta de saida</Label>
          <Input {...form.register("from_bank_account")} />
        </div>
        <div className="space-y-2">
          <Label>Banco/conta de entrada</Label>
          <Input {...form.register("to_bank_account")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Valor</Label>
          <Input type="number" step="0.01" {...form.register("amount")} />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" {...form.register("transfer_date")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descricao</Label>
        <Input {...form.register("description")} />
      </div>
      <div className="space-y-2">
        <Label>Observacoes</Label>
        <Input {...form.register("notes")} />
      </div>
      <Button disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Criar transferencia
      </Button>
    </form>
  );
}
