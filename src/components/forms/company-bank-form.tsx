"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { updateCompanyBankSettingsAction } from "@/app/(app)/minha-empresa/actions";
import {
  companyBankSettingsSchema,
  type CompanyBankSettingsFormValues,
} from "@/lib/schemas";
import type { CompanySettings } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CompanyBankForm({
  settings,
  canEdit,
}: {
  settings?: CompanySettings | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const form = useForm<CompanyBankSettingsFormValues>({
    resolver: zodResolver(companyBankSettingsSchema),
    defaultValues: {
      bank_name: settings?.bank_name ?? "",
      bank_agency: settings?.bank_agency ?? "",
      bank_account: settings?.bank_account ?? "",
      bank_account_type: settings?.bank_account_type ?? "",
      pix_key: settings?.pix_key ?? "",
      bank_account_holder: settings?.bank_account_holder ?? "",
      bank_holder_document: settings?.bank_holder_document ?? "",
      bank_notes: settings?.bank_notes ?? "",
      payment_instructions: settings?.payment_instructions ?? "",
    },
  });

  function submit(values: CompanyBankSettingsFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );

    startTransition(() => {
      void (async () => {
        try {
          await updateCompanyBankSettingsAction(formData);
          setFeedback("Dados bancarios salvos.");
          router.refresh();
        } catch (error) {
          setFeedback(
            error instanceof Error ? error.message : "Nao foi possivel salvar os dados bancarios.",
          );
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

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Banco">
          <Input disabled={!canEdit} {...form.register("bank_name")} />
        </Field>
        <Field label="Agencia">
          <Input disabled={!canEdit} {...form.register("bank_agency")} />
        </Field>
        <Field label="Conta">
          <Input disabled={!canEdit} {...form.register("bank_account")} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Tipo de conta">
          <Input disabled={!canEdit} {...form.register("bank_account_type")} />
        </Field>
        <Field label="Chave PIX">
          <Input disabled={!canEdit} {...form.register("pix_key")} />
        </Field>
        <Field label="Titular">
          <Input disabled={!canEdit} {...form.register("bank_account_holder")} />
        </Field>
      </div>

      <Field label="CPF/CNPJ do titular">
        <Input disabled={!canEdit} {...form.register("bank_holder_document")} />
      </Field>

      <Field label="Dados para recebimento">
        <Textarea disabled={!canEdit} {...form.register("payment_instructions")} />
      </Field>

      <Field label="Observacoes">
        <Textarea disabled={!canEdit} {...form.register("bank_notes")} />
      </Field>

      {canEdit ? (
        <Button disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Salvar dados bancarios
        </Button>
      ) : null}

      {feedback ? <p className="rounded-md bg-secondary px-3 py-2 text-sm">{feedback}</p> : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
