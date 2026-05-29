"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { createClientInlineAction } from "@/app/(app)/clientes/actions";
import { createServiceCardAction } from "@/app/(app)/servicos/actions";
import { paymentStatuses, proposalServiceTypes } from "@/lib/constants";
import { serviceCardSchema, type ServiceCardFormValues } from "@/lib/schemas";
import { formatBrlCurrency, parseBrlCurrencyInput } from "@/lib/services/service-finance";
import type { Client, ProposalServiceType, ServiceColumn } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ServiceCardForm({
  clients,
  columns,
  columnByServiceType,
  members = [],
  defaultServiceType = "georreferenciamento",
  onCreated,
}: {
  clients: Client[];
  columns: ServiceColumn[];
  columnByServiceType?: Partial<Record<ProposalServiceType, string>>;
  members?: Array<{ id: string; label: string }>;
  defaultServiceType?: ProposalServiceType;
  onCreated?: (result: Awaited<ReturnType<typeof createServiceCardAction>>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [clientOptions, setClientOptions] = useState<Client[]>(clients);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClient, setQuickClient] = useState({
    name: "",
    kind: "pf",
    document: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [estimatedValue, setEstimatedValue] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const initialColumnId =
    columnByServiceType?.[defaultServiceType] ?? columns[0]?.id ?? "";
  const form = useForm<ServiceCardFormValues>({
    resolver: zodResolver(serviceCardSchema),
    defaultValues: {
      column_id: initialColumnId,
      client_id: "",
      title: "",
      description: "",
      service_type: defaultServiceType,
      priority: "medium",
      payment_status: "pagamento_nao_efetuado",
      service_date: todayDate(),
      due_date: "",
      municipality: "",
      responsible_user_id: "",
      payment_condition: "",
      custom_service_name: "",
      custom_fields_json: "{}",
    },
  });
  const selectedType = form.watch("service_type") ?? defaultServiceType;
  const filteredClients = clientOptions
    .filter((client) =>
      client.name.toLowerCase().includes(clientSearch.trim().toLowerCase()),
    )
    .slice(0, 10);

  useEffect(() => {
    const nextColumnId = columnByServiceType?.[selectedType as ProposalServiceType];
    if (nextColumnId) form.setValue("column_id", nextColumnId);
  }, [columnByServiceType, form, selectedType]);

  function submit(values: ServiceCardFormValues) {
    const parsedEstimatedValue = parseBrlCurrencyInput(estimatedValue);
    if (estimatedValue.trim() && parsedEstimatedValue === null) {
      setFeedback({
        type: "error",
        message: "Informe o valor no formato R$ 16.000,00.",
      });
      return;
    }

    const formData = new FormData();
    const metadata = {
      valor_previsto: parsedEstimatedValue,
      responsavel_principal:
        members.find((member) => member.id === values.responsible_user_id)?.label ?? null,
      municipio: values.municipality || null,
      condicao_pagamento: values.payment_condition || null,
      custom_service_name: values.custom_service_name || null,
    };
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );
    formData.set("custom_fields_json", JSON.stringify(metadata));
    startTransition(() => {
      void (async () => {
        setFeedback(null);
        try {
          const result = await createServiceCardAction(formData);
          form.reset({
            ...values,
            title: "",
            description: "",
            client_id: values.client_id ?? "",
            service_date: todayDate(),
            municipality: "",
            responsible_user_id: values.responsible_user_id ?? "",
            payment_condition: "",
            custom_service_name: "",
            custom_fields_json: "{}",
          });
          setEstimatedValue("");
          setFeedback({ type: "success", message: "Servico criado com sucesso." });
          onCreated?.(result);
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Nao foi possivel criar o servico.",
          });
        }
      })();
    });
  }

  return (
    <form
      className="grid gap-4"
      data-testid="new-service-form"
      onSubmit={form.handleSubmit(submit)}
    >
      <input type="hidden" {...form.register("column_id")} />
      <input type="hidden" {...form.register("custom_fields_json")} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service-type">Tipo de servico</Label>
          <select
            id="service-type"
            data-testid="service-type"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("service_type")}
          >
            {proposalServiceTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {selectedType === "outros_servicos" ? (
          <div className="space-y-2">
            <Label htmlFor="custom-service-name">Qual servico?</Label>
            <Input
              id="custom-service-name"
              placeholder="Ex.: Desmembramento, usucapiao, consultoria"
              {...form.register("custom_service_name")}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="service-client">Cliente</Label>
          <Input
            className="mb-2"
            placeholder="Buscar cliente pelo nome"
            value={clientSearch}
            onChange={(event) => setClientSearch(event.target.value)}
          />
          <select
            id="service-client"
            data-testid="service-client"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("client_id")}
          >
            <option value="">Sem cliente vinculado</option>
            {filteredClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Mostrando ate 10 resultados.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setQuickClientOpen((value) => !value)}>
            <Plus aria-hidden="true" />
            Cadastrar cliente
          </Button>
        </div>
      </div>

      {quickClientOpen ? (
        <div className="rounded-md border bg-secondary/40 p-4">
          <h3 className="text-sm font-semibold">Cadastrar cliente rapido</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <QuickClientField
              label="Nome"
              value={quickClient.name}
              required
              onChange={(value) => setQuickClient((current) => ({ ...current, name: value }))}
            />
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={quickClient.kind}
                onChange={(event) => setQuickClient((current) => ({ ...current, kind: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="pf">Pessoa fisica</option>
                <option value="pj">Pessoa juridica</option>
              </select>
            </div>
            <QuickClientField label="CPF/CNPJ" value={quickClient.document} onChange={(value) => setQuickClient((current) => ({ ...current, document: value }))} />
            <QuickClientField label="E-mail" type="email" value={quickClient.email} onChange={(value) => setQuickClient((current) => ({ ...current, email: value }))} />
            <QuickClientField label="Telefone" value={quickClient.phone} onChange={(value) => setQuickClient((current) => ({ ...current, phone: value }))} />
            <QuickClientField label="Endereco" value={quickClient.address} onChange={(value) => setQuickClient((current) => ({ ...current, address: value }))} />
            <div className="space-y-2 md:col-span-2">
              <Label>Observacoes</Label>
              <Textarea value={quickClient.notes} onChange={(event) => setQuickClient((current) => ({ ...current, notes: event.target.value }))} />
            </div>
            <Button
              type="button"
              className="md:col-span-2"
              disabled={pending}
              onClick={() => {
                const formData = new FormData();
                Object.entries(quickClient).forEach(([key, value]) => formData.set(key, value));
                startTransition(() => {
                  void (async () => {
                    try {
                      const client = await createClientInlineAction(formData);
                      const nextClient = { ...client, kind: quickClient.kind } as Client;
                      setClientOptions((current) => [nextClient, ...current]);
                      form.setValue("client_id", client.id);
                      setQuickClientOpen(false);
                      setQuickClient({ name: "", kind: "pf", document: "", email: "", phone: "", address: "", notes: "" });
                    } catch (error) {
                      setFeedback({
                        type: "error",
                        message: error instanceof Error ? error.message : "Nao foi possivel cadastrar cliente.",
                      });
                    }
                  })();
                });
              }}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              Criar cliente e selecionar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="service-title">Nome do imovel / empreendimento</Label>
        <Input id="service-title" data-testid="service-title" {...form.register("title")} />
        {form.formState.errors.title ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.title.message?.toString()}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-description">Descricao / observacoes iniciais</Label>
        <Textarea
          id="service-description"
          rows={4}
          {...form.register("description")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-municipality">Municipio</Label>
        <Input id="service-municipality" {...form.register("municipality")} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="service-priority">Prioridade</Label>
          <select
            id="service-priority"
            data-testid="service-priority"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("priority")}
          >
            <option value="low">Baixa</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-date">Data de criacao</Label>
          <Input id="service-date" type="date" {...form.register("service_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-due-date">Data prevista / prazo</Label>
          <Input id="service-due-date" type="date" {...form.register("due_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-payment-status">Status de pagamento</Label>
          <select
            id="service-payment-status"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("payment_status")}
          >
            {paymentStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service-estimated-value">Valor previsto/proposta</Label>
          <Input
            id="service-estimated-value"
            inputMode="decimal"
            placeholder="R$ 16.000,00"
            value={estimatedValue}
            onChange={(event) => setEstimatedValue(event.target.value)}
            onBlur={() => {
              const parsed = parseBrlCurrencyInput(estimatedValue);
              if (parsed !== null) setEstimatedValue(formatBrlCurrency(parsed));
            }}
          />
          <p className="text-xs text-muted-foreground">
            Use valores como R$ 16.000,00 ou 1500,50.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-responsible">Responsavel principal</Label>
          <select
            id="service-responsible"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("responsible_user_id")}
          >
            <option value="">Sem responsavel definido</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-payment-condition">Condicao de pagamento</Label>
        <Textarea
          id="service-payment-condition"
          rows={2}
          placeholder="Ex.: 50% na entrada e 50% na entrega."
          {...form.register("payment_condition")}
        />
      </div>

      <Button data-testid="create-service-submit" disabled={pending || !initialColumnId}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {pending ? "Criando..." : "Criar servico"}
      </Button>

      {feedback ? (
        <p
          className={`rounded-md p-2 text-sm ${
            feedback.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function QuickClientField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
