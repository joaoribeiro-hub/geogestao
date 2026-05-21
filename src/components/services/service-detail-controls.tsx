"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, UserPlus } from "lucide-react";
import {
  addServiceMemberAction,
  createClientForServiceAction,
  createContractForServiceAction,
  createProposalForServiceAction,
  createServiceInteractionAction,
  updateServicePaymentStatusAction,
  updateServicePriorityAction,
  updateServiceStageAction,
} from "@/app/(app)/servicos/actions";
import type { PaymentStatus, Priority } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ServiceFieldSelect({
  cardId,
  value,
  options,
  kind,
  label,
}: {
  cardId: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  kind: "stage" | "priority" | "payment";
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="bg-transparent text-xs font-semibold outline-none"
        defaultValue={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(() => {
            if (kind === "stage") void updateServiceStageAction(cardId, next);
            if (kind === "priority") {
              void updateServicePriorityAction(cardId, next as Priority);
            }
            if (kind === "payment") {
              void updateServicePaymentStatusAction(cardId, next as PaymentStatus);
            }
          });
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {pending ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
    </label>
  );
}

export function ServiceClientCreatePanel({ serviceCardId }: { serviceCardId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-md border bg-secondary/40 p-4" id="cliente">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Cliente do servico</h3>
          <p className="text-sm text-muted-foreground">
            Este servico ainda nao possui cliente vinculado.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
          <UserPlus aria-hidden="true" />
          Cadastrar cliente
        </Button>
      </div>

      {open ? (
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => {
              void (async () => {
                setMessage(null);
                try {
                  await createClientForServiceAction(serviceCardId, formData);
                  setMessage("Cliente criado e vinculado ao servico.");
                  event.currentTarget.reset();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Nao foi possivel criar cliente.");
                }
              })();
            });
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                name="kind"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="pf"
              >
                <option value="pf">Pessoa fisica</option>
                <option value="pj">Pessoa juridica</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input name="document" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input name="phone" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereco</Label>
            <Input name="address" />
          </div>
          <div className="space-y-2">
            <Label>Observacoes</Label>
            <Textarea name="notes" />
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Criar e vincular cliente
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function ServiceQuickActionButton({
  serviceCardId,
  action,
  children,
}: {
  serviceCardId: string;
  action: "proposal" | "contract";
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            void (async () => {
              setMessage(null);
              try {
                if (action === "proposal") await createProposalForServiceAction(serviceCardId);
                if (action === "contract") await createContractForServiceAction(serviceCardId);
                setMessage(action === "proposal" ? "Proposta criada." : "Contrato criado.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Nao foi possivel criar.");
              }
            })();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}

export function ServiceMemberForm({
  serviceCardId,
  members,
}: {
  serviceCardId: string;
  members: Array<{ id: string; label: string }>;
}) {
  const [pending, startTransition] = useTransition();
  if (!members.length) {
    return <p className="text-sm text-muted-foreground">Nenhum membro ativo na organizacao.</p>;
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_150px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("service_card_id", serviceCardId);
        startTransition(() => {
          void addServiceMemberAction(formData);
        });
      }}
    >
      <select
        name="user_id"
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.label}
          </option>
        ))}
      </select>
      <select
        name="role"
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        defaultValue="responsavel"
      >
        <option value="responsavel">Responsavel</option>
        <option value="apoio">Apoio</option>
        <option value="financeiro">Financeiro</option>
      </select>
      <Button disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Membros
      </Button>
    </form>
  );
}

export function ServiceInteractionForm({ serviceCardId }: { serviceCardId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        <Plus aria-hidden="true" />
        Criar interacao
      </Button>
      {open ? (
        <form
          className="grid gap-3 rounded-md border bg-background p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            formData.set("service_card_id", serviceCardId);
            startTransition(() => {
              void (async () => {
                setMessage(null);
                try {
                  await createServiceInteractionAction(formData);
                  setMessage("Interacao registrada no historico do servico.");
                  form.reset();
                  setOpen(false);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Nao foi possivel registrar a interacao.");
                }
              })();
            });
          }}
        >
          <div className="space-y-2">
            <Label>Titulo</Label>
            <Input name="title" defaultValue="Interacao registrada" />
          </div>
          <div className="space-y-2">
            <Label>Descricao</Label>
            <Textarea name="description" required placeholder="Ex.: Cliente pediu retorno sobre documentos." />
          </div>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
          <Button disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Registrar interacao
          </Button>
        </form>
      ) : message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
