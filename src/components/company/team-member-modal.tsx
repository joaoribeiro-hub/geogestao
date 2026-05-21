"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createTeamMemberAction,
  updateTeamMemberAction,
} from "@/app/(app)/minha-empresa/actions";
import { teamMemberSchema, type TeamMemberFormValues } from "@/lib/schemas";
import { formatBrlCurrency, parseBrlCurrencyInput } from "@/lib/services/service-finance";
import type { Json, TeamMember } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TeamMemberModal({
  canEdit,
  member,
  triggerLabel,
}: {
  canEdit: boolean;
  member?: TeamMember;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const bankDetails = asRecord(member?.bank_details);
  const form = useForm<TeamMemberFormValues>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: {
      name: member?.name ?? "",
      email: member?.email ?? "",
      document_number: member?.document_number ?? "",
      pix_key: member?.pix_key ?? "",
      bank_name: textValue(bankDetails.bank_name),
      bank_agency: textValue(bankDetails.bank_agency),
      bank_account: textValue(bankDetails.bank_account),
      monthly_amount: member?.monthly_amount ? formatBrlCurrency(member.monthly_amount) : "",
      role_title: member?.role_title ?? "",
      notes: member?.notes ?? "",
      status: member?.status ?? "active",
    },
  });

  function submit(values: TeamMemberFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );

    startTransition(() => {
      void (async () => {
        setFeedback(null);
        try {
          if (member) {
            await updateTeamMemberAction(member.id, formData);
          } else {
            await createTeamMemberAction(formData);
          }
          form.reset();
          setOpen(false);
          router.refresh();
        } catch (error) {
          setFeedback(
            error instanceof Error ? error.message : "Nao foi possivel cadastrar o membro.",
          );
        }
      })();
    });
  }

  if (!canEdit) {
    return null;
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {member ? null : <Plus aria-hidden="true" />}
        {triggerLabel ?? (member ? "Editar" : "Cadastrar membro")}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={member ? "Editar membro" : "Cadastrar membro"}
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">
                  {member ? "Editar membro" : "Cadastrar membro"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Membro operacional da empresa. Convite de acesso fica para etapa futura.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <form className="grid gap-4 p-5" onSubmit={form.handleSubmit(submit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome">
                  <Input {...form.register("name")} />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  ) : null}
                </Field>
                <Field label="E-mail">
                  <Input type="email" {...form.register("email")} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Documento principal">
                  <Input {...form.register("document_number")} />
                </Field>
                <Field label="Chave PIX">
                  <Input {...form.register("pix_key")} />
                </Field>
                <Field label="Cargo/funcao">
                  <Input {...form.register("role_title")} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Banco">
                  <Input {...form.register("bank_name")} />
                </Field>
                <Field label="Agencia">
                  <Input {...form.register("bank_agency")} />
                </Field>
                <Field label="Conta">
                  <Input {...form.register("bank_account")} />
                </Field>
                <Field label="Valor mensal">
                  <Input
                    inputMode="decimal"
                    placeholder="R$ 3.000,00"
                    {...form.register("monthly_amount")}
                    onBlur={(event) => {
                      const parsed = parseBrlCurrencyInput(event.target.value);
                      if (parsed !== null) {
                        form.setValue("monthly_amount", formatBrlCurrency(parsed));
                      }
                    }}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <Field label="Observacoes">
                  <Textarea {...form.register("notes")} />
                </Field>
                <Field label="Status">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...form.register("status")}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </Field>
              </div>

              <Button disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                {member ? "Salvar alteracoes" : "Cadastrar membro"}
              </Button>

              {feedback ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{feedback}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function asRecord(value: Json | undefined): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}

function textValue(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
