"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, LogIn, Plus } from "lucide-react";
import {
  createOrganizationAction,
  joinOrganizationByCodeAction,
} from "@/app/(app)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Mode = "join" | "create" | null;

export function OrganizationOnboarding() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submitJoin(formData: FormData) {
    startTransition(() => {
      void (async () => {
        const result = await joinOrganizationByCodeAction({
          joinCode: String(formData.get("joinCode") ?? ""),
        });
        setMessage(result.message);
        if (result.ok) {
          router.replace("/inicio");
          router.refresh();
        }
      })();
    });
  }

  function submitCreate(formData: FormData) {
    startTransition(() => {
      void (async () => {
        const result = await createOrganizationAction({
          name: String(formData.get("name") ?? ""),
          documentNumber: String(formData.get("documentNumber") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          address: String(formData.get("address") ?? ""),
          city: String(formData.get("city") ?? ""),
          state: String(formData.get("state") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        });
        setMessage(result.message);
        if (result.ok) {
          router.replace("/inicio");
          router.refresh();
        }
      })();
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          className="rounded-lg border bg-card p-5 text-left shadow-sm transition hover:border-primary"
          onClick={() => {
            setMode("join");
            setMessage(null);
          }}
          data-testid="onboarding-join-option"
        >
          <LogIn className="mb-4 size-5 text-primary" aria-hidden="true" />
          <p className="font-semibold">Participar de uma empresa</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use o ID da empresa compartilhado pelo proprietario.
          </p>
        </button>

        <button
          type="button"
          className="rounded-lg border bg-card p-5 text-left shadow-sm transition hover:border-primary"
          onClick={() => {
            setMode("create");
            setMessage(null);
          }}
          data-testid="onboarding-create-option"
        >
          <Building2 className="mb-4 size-5 text-primary" aria-hidden="true" />
          <p className="font-semibold">Cadastrar empresa</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie uma nova organizacao vazia e comece como proprietario.
          </p>
        </button>
      </div>

      {mode === "join" ? (
        <form action={submitJoin} className="grid gap-4 rounded-lg border bg-card p-5">
          <div>
            <h2 className="font-semibold">Participar de uma empresa</h2>
            <p className="text-sm text-muted-foreground">
              O ID da empresa e sensivel. Peca o codigo ao proprietario.
            </p>
          </div>
          <Field label="ID da empresa">
            <Input name="joinCode" placeholder="Ex.: A1B2C3D4E5" data-testid="join-code-input" />
          </Field>
          <Button className="w-fit" disabled={pending} data-testid="join-company-submit">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            Participar de uma empresa
          </Button>
        </form>
      ) : null}

      {mode === "create" ? (
        <form action={submitCreate} className="grid gap-4 rounded-lg border bg-card p-5">
          <div>
            <h2 className="font-semibold">Cadastrar empresa</h2>
            <p className="text-sm text-muted-foreground">
              A empresa sera criada sem copiar dados de outra organizacao.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome da empresa">
              <Input name="name" required data-testid="company-name-input" />
            </Field>
            <Field label="CNPJ ou CPF responsavel">
              <Input name="documentNumber" />
            </Field>
            <Field label="Telefone">
              <Input name="phone" />
            </Field>
            <Field label="E-mail comercial">
              <Input name="email" type="email" />
            </Field>
            <Field label="Cidade">
              <Input name="city" />
            </Field>
            <Field label="Estado">
              <Input name="state" maxLength={2} />
            </Field>
          </div>
          <Field label="Endereco">
            <Input name="address" />
          </Field>
          <Field label="Observacoes">
            <Textarea name="notes" />
          </Field>
          <Button className="w-fit" disabled={pending} data-testid="create-company-submit">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Finalizar cadastro da empresa
          </Button>
        </form>
      ) : null}

      {message ? (
        <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground" data-testid="onboarding-message">
          {message}
        </p>
      ) : null}
    </div>
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
