"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, UserPlus, X } from "lucide-react";
import {
  addServiceMemberAction,
  addServicePropertyInfoAction,
  addServiceReceiptAction,
  createClientForServiceAction,
  createContractForServiceAction,
  createProposalForServiceAction,
  createServiceInteractionAction,
  deleteServicePropertyInfoAction,
  deleteServiceReceiptAction,
  linkExistingClientToServiceAction,
  updateServiceDetailsAction,
  updateServicePaymentStatusAction,
  updateServicePriorityAction,
  updateServiceStageAction,
} from "@/app/(app)/servicos/actions";
import { formatBrlCurrency, parseBrlCurrencyInput } from "@/lib/services/service-finance";
import { formatDate } from "@/lib/utils";
import type { Client, Revenue, ServiceCard, ServiceColumn, ServicePropertyInfo, PaymentStatus, Priority } from "@/types/database";
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

export function ServiceClientCreatePanel({
  serviceCardId,
  clients,
  canEdit,
}: {
  serviceCardId: string;
  clients: Client[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const filteredClients = clients
    .filter((client) => {
      const value = search.trim().toLowerCase();
      if (!value) return false;
      return [client.name, client.document, client.phone, client.email]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(value));
    })
    .slice(0, 10);

  return (
    <div className="rounded-md border bg-secondary/40 p-4" id="cliente">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Cliente do servico</h3>
          <p className="text-sm text-muted-foreground">
            Este servico ainda nao possui cliente vinculado.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
            <UserPlus aria-hidden="true" />
            Cadastrar cliente
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label>Vincular cliente existente</Label>
            <Input
              placeholder="Buscar cliente pelo nome, CPF/CNPJ ou telefone..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {search.trim() ? (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-background p-2">
              {filteredClients.length ? (
                filteredClients.map((client) => (
                  <div key={client.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.document ?? "Sem documento"} · {client.phone ?? client.email ?? "Sem contato"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => {
                          void (async () => {
                            setMessage(null);
                            try {
                              await linkExistingClientToServiceAction(serviceCardId, client.id);
                              setMessage(`Cliente ${client.name} vinculado ao servico.`);
                            } catch (error) {
                              setMessage(error instanceof Error ? error.message : "Nao foi possivel vincular cliente.");
                            }
                          })();
                        })
                      }
                    >
                      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                      Vincular
                    </Button>
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado nesta empresa.</p>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-background p-3 text-sm text-muted-foreground">
          Apenas o proprietario da empresa ou o responsavel principal pode vincular cliente ao servico.
        </p>
      )}

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
                  window.dispatchEvent(new Event("geogestao:notifications-refresh"));
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data do lembrete</Label>
              <Input name="reminder_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Horario</Label>
              <Input name="reminder_time" type="time" />
            </div>
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

export function ServiceEditModal({
  card,
  members,
}: {
  card: ServiceCard;
  clients: Client[];
  columns: ServiceColumn[];
  members: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(formatBrlCurrency(Number((card.custom_fields_json as Record<string, unknown>)?.valor_previsto ?? 0)));

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Editar
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true">
          <form
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const parsedValue = parseBrlCurrencyInput(value);
              formData.set("estimated_value", parsedValue === null ? "" : String(parsedValue));
              startTransition(() => {
                void (async () => {
                  await updateServiceDetailsAction(card.id, formData);
                  setOpen(false);
                })();
              });
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Editar servico</h2>
                <p className="text-sm text-muted-foreground">Altere os dados principais e financeiros do servico.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome do proprietario" name="description" defaultValue={card.description ?? ""} textarea />
              <Field label="Nome do imovel" name="title" defaultValue={card.title} />
              <Field label="Municipio" name="municipality" defaultValue={card.municipality ?? ""} />
              <Field label="Data prevista" name="due_date" type="date" defaultValue={card.due_date ?? ""} />
              <div className="space-y-2">
                <Label>Responsavel principal</Label>
                <select name="responsible_user_id" defaultValue={card.responsible_user_id ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Sem responsavel</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de servico</Label>
                <select name="service_type" defaultValue={card.service_type ?? "outros_servicos"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="georreferenciamento">Georreferenciamento</option>
                  <option value="car">CAR</option>
                  <option value="itr_ccir">ITR/CCIR</option>
                  <option value="outros_servicos">Outros</option>
                </select>
              </div>
              <Field label="Qual servico? (quando Outros)" name="custom_service_name" defaultValue={card.custom_service_name ?? ""} />
              <div className="space-y-2">
                <Label>Valor combinado</Label>
                <Input value={value} onChange={(event) => setValue(event.target.value)} />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Condicao de pagamento</Label>
              <Textarea name="payment_condition" defaultValue={card.payment_condition ?? ""} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}Salvar</Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function ServiceFinancePanel({
  serviceCardId,
  combinedValue,
  paymentCondition,
  receivedTotal,
  revenues,
}: {
  serviceCardId: string;
  combinedValue: number;
  paymentCondition: string;
  receivedTotal: number;
  revenues: Revenue[];
}) {
  const [pending, startTransition] = useTransition();
  const receivable = Math.max(combinedValue - receivedTotal, 0);
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">Financeiro</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <FinanceInfo label="Valor combinado" value={formatBrlCurrency(combinedValue)} />
        <FinanceInfo label="Condicao de pagamento" value={paymentCondition || "-"} />
        <FinanceInfo label="Valores recebidos" value={formatBrlCurrency(receivedTotal)} />
        <FinanceInfo label="Valores a receber" value={formatBrlCurrency(receivable)} />
      </div>
      <form
        className="mt-4 grid gap-3 md:grid-cols-[160px_160px_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("service_card_id", serviceCardId);
          startTransition(() => {
            void addServiceReceiptAction(formData);
            event.currentTarget.reset();
          });
        }}
      >
        <Input name="amount" placeholder="R$ 1.200,50" required />
        <Input name="paid_at" type="date" required />
        <Input name="description" placeholder="Observacao" />
        <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}Receber</Button>
      </form>
      <div className="mt-4 space-y-2">
        {revenues.map((revenue) => (
          <div key={revenue.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
            <span>{formatBrlCurrency(Number(revenue.amount))} · {formatDate(revenue.paid_at ?? revenue.due_date)} · {revenue.description}</span>
            <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => startTransition(() => void deleteServiceReceiptAction(revenue.id))}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServicePropertyInfoPanel({
  serviceCardId,
  items,
}: {
  serviceCardId: string;
  items: ServicePropertyInfo[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">Informacoes adicionais do imovel</h2>
      <form
        className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("service_card_id", serviceCardId);
          startTransition(() => {
            void addServicePropertyInfoAction(formData);
            event.currentTarget.reset();
          });
        }}
      >
        <Input name="title" placeholder="Matricula" required />
        <Input name="value" placeholder="Valor / descricao" required />
        <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}Adicionar</Button>
      </form>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
            <span><strong>{item.title}:</strong> {item.value}</span>
            <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => startTransition(() => void deleteServicePropertyInfoAction(item.id, serviceCardId))}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  textarea = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {textarea ? <Textarea name={name} defaultValue={defaultValue} /> : <Input name={name} type={type} defaultValue={defaultValue} />}
    </div>
  );
}
