"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
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
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome fantasia" error={form.formState.errors.trade_name?.message}>
          <Input disabled={!canEdit} {...form.register("trade_name")} />
        </Field>
        <Field label="Razao social" error={form.formState.errors.legal_name?.message}>
          <Input disabled={!canEdit} {...form.register("legal_name")} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="CNPJ" error={form.formState.errors.cnpj?.message}>
          <Input disabled={!canEdit} {...form.register("cnpj")} />
        </Field>
        <Field label="Telefone" error={form.formState.errors.phone?.message}>
          <Input disabled={!canEdit} {...form.register("phone")} />
        </Field>
        <Field label="E-mail" error={form.formState.errors.email?.message}>
          <Input disabled={!canEdit} type="email" {...form.register("email")} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Site" error={form.formState.errors.website?.message}>
          <Input disabled={!canEdit} placeholder="https://..." {...form.register("website")} />
        </Field>
        <Field label="Logo" error={form.formState.errors.logo_url?.message}>
          <Input disabled={!canEdit} placeholder="URL ou caminho do arquivo" {...form.register("logo_url")} />
        </Field>
      </div>

      <Field label="Endereco" error={form.formState.errors.address?.message}>
        <Input disabled={!canEdit} {...form.register("address")} />
      </Field>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
        <Field label="Cidade" error={form.formState.errors.city?.message}>
          <Input disabled={!canEdit} {...form.register("city")} />
        </Field>
        <Field label="UF" error={form.formState.errors.state?.message}>
          <Input disabled={!canEdit} maxLength={2} {...form.register("state")} />
        </Field>
      </div>

      <Field label="Observacoes" error={form.formState.errors.notes?.message}>
        <Textarea disabled={!canEdit} {...form.register("notes")} />
      </Field>

      {canEdit ? (
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
