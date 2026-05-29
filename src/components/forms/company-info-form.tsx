"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { updateCompanySettingsAction } from "@/app/(app)/minha-empresa/actions";
import {
  companySettingsSchema,
  type CompanySettingsFormValues,
} from "@/lib/schemas";
import type { CompanySettings } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CompanyInfoForm({
  settings,
  canEdit = true,
}: {
  settings?: CompanySettings | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      trade_name: settings?.trade_name ?? "",
      legal_name: settings?.legal_name ?? "",
      cnpj: settings?.cnpj ?? "",
      phone: settings?.phone ?? "",
      email: settings?.email ?? "",
      website: settings?.website ?? "",
      address: settings?.address ?? "",
      city: settings?.city ?? "",
      state: settings?.state ?? "",
      logo_url: settings?.logo_url ?? "",
      notes: settings?.notes ?? "",
      mission: settings?.mission ?? "",
      vision: settings?.vision ?? "",
      values_statement: settings?.values_statement ?? "",
    },
  });

  function submit(values: CompanySettingsFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );

    startTransition(() => {
      void (async () => {
        setFeedback(null);
        try {
          await updateCompanySettingsAction(formData);
          setFeedback({ type: "success", message: "Informacoes salvas." });
          setEditing(false);
          router.refresh();
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Nao foi possivel salvar as informacoes.",
          });
        }
      })();
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      {!canEdit ? (
        <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
          Apenas o proprietario da empresa pode editar estas informacoes.
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex justify-end gap-2">
          {!editing ? (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Editar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                setEditing(false);
              }}
            >
              <X aria-hidden="true" />
              Cancelar
            </Button>
          )}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome fantasia" error={form.formState.errors.trade_name?.message}>
              {editing ? <Input {...form.register("trade_name")} /> : <ReadOnlyValue value={form.getValues("trade_name")} />}
            </Field>
            <Field label="Razao social" error={form.formState.errors.legal_name?.message}>
              {editing ? <Input {...form.register("legal_name")} /> : <ReadOnlyValue value={form.getValues("legal_name")} />}
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="CNPJ" error={form.formState.errors.cnpj?.message}>
              {editing ? <Input {...form.register("cnpj")} /> : <ReadOnlyValue value={form.getValues("cnpj")} />}
            </Field>
            <Field label="Telefone" error={form.formState.errors.phone?.message}>
              {editing ? <Input {...form.register("phone")} /> : <ReadOnlyValue value={form.getValues("phone")} />}
            </Field>
            <Field label="E-mail" error={form.formState.errors.email?.message}>
              {editing ? <Input type="email" {...form.register("email")} /> : <ReadOnlyValue value={form.getValues("email")} />}
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Site" error={form.formState.errors.website?.message}>
              {editing ? <Input placeholder="https://..." {...form.register("website")} /> : <ReadOnlyValue value={form.getValues("website")} />}
            </Field>
            <Field label="Logo" error={form.formState.errors.logo_url?.message}>
              {editing ? <Input placeholder="URL ou caminho do arquivo" {...form.register("logo_url")} /> : <ReadOnlyValue value={form.getValues("logo_url")} />}
            </Field>
          </div>

          <Field label="Endereco" error={form.formState.errors.address?.message}>
            {editing ? <Input {...form.register("address")} /> : <ReadOnlyValue value={form.getValues("address")} />}
          </Field>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Cidade" error={form.formState.errors.city?.message}>
              {editing ? <Input {...form.register("city")} /> : <ReadOnlyValue value={form.getValues("city")} />}
            </Field>
            <Field label="UF" error={form.formState.errors.state?.message}>
              {editing ? <Input maxLength={2} {...form.register("state")} /> : <ReadOnlyValue value={form.getValues("state")} />}
            </Field>
          </div>

          <Field label="Observacoes" error={form.formState.errors.notes?.message}>
            {editing ? <Textarea {...form.register("notes")} /> : <ReadOnlyValue multiline value={form.getValues("notes")} />}
          </Field>
        </div>
        <div className="space-y-4 rounded-md border bg-background p-4">
          <Field label="Missao" error={form.formState.errors.mission?.message}>
            {editing ? <Textarea rows={4} {...form.register("mission")} /> : <ReadOnlyValue multiline value={form.getValues("mission")} />}
          </Field>
          <Field label="Visao" error={form.formState.errors.vision?.message}>
            {editing ? <Textarea rows={4} {...form.register("vision")} /> : <ReadOnlyValue multiline value={form.getValues("vision")} />}
          </Field>
          <Field label="Valores" error={form.formState.errors.values_statement?.message}>
            {editing ? <Textarea rows={5} {...form.register("values_statement")} /> : <ReadOnlyValue multiline value={form.getValues("values_statement")} />}
          </Field>
        </div>
      </div>

      {canEdit && editing ? (
      <Button disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
        Salvar informacoes
      </Button>
      ) : null}

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

function ReadOnlyValue({ value, multiline = false }: { value?: string | null; multiline?: boolean }) {
  return (
    <div className={`rounded-md border bg-secondary/40 px-3 py-2 text-sm ${multiline ? "min-h-20 whitespace-pre-wrap" : "min-h-10"}`}>
      {value?.trim() ? value : <span className="text-muted-foreground">Nao informado</span>}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
