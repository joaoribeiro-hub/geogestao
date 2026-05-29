"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  forgotPasswordSchema,
  formatCpf,
  onlyDigits,
  signUpSchema,
} from "@/lib/auth-validation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "Informe a senha."),
});

type LoginValues = z.infer<typeof loginSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;
type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    setReady(true);
    if (params.get("passwordReset")) {
      setNotice("Senha redefinida. Entre novamente.");
    }
    if (params.get("registered")) {
      setNotice("Conta confirmada. Entre com seu e-mail e senha.");
    }
  }, [params]);

  async function onSubmit(values: LoginValues) {
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword(values);
    setLoading(false);

    if (authError) {
      setError("E-mail ou senha invalidos.");
      return;
    }

    const redirectedFrom = params.get("redirectedFrom");
    router.replace(redirectedFrom && redirectedFrom !== "/" ? redirectedFrom : "/inicio");
    router.refresh();
  }

  return (
    <>
      <form
        className="space-y-4"
        data-e2e-ready={ready ? "true" : "false"}
        data-testid="login-form"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            data-testid="login-email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            data-testid="login-password"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>
        {error ? (
          <p
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            data-testid="login-error"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}
        <Button className="w-full" data-testid="login-submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Entrar
        </Button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setSignUpOpen(true)}
            data-testid="open-signup"
          >
            Criar cadastro
          </button>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setForgotOpen(true)}
            data-testid="open-forgot-password"
          >
            Esqueci minha senha
          </button>
        </div>
      </form>

      {signUpOpen ? <SignUpModal onClose={() => setSignUpOpen(false)} /> : null}
      {forgotOpen ? <ForgotPasswordModal onClose={() => setForgotOpen(false)} /> : null}
    </>
  );
}

function SignUpModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      cpf: "",
      birthDate: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function submit(values: SignUpValues) {
    setPending(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?registered=1`,
        data: {
          full_name: values.fullName,
          cpf: onlyDigits(values.cpf),
          birth_date: values.birthDate,
        },
      },
    });
    setPending(false);

    if (error) {
      setMessage("Nao foi possivel iniciar o cadastro. Confira os dados e tente novamente.");
      return;
    }

    form.reset();
    setMessage("Cadastro iniciado. Confira seu e-mail para confirmar a conta.");
  }

  return (
    <AuthModal title="Criar cadastro" description="Crie sua conta e confirme o e-mail para entrar." onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(submit)} data-testid="signup-form">
        <Field label="Nome completo">
          <Input {...form.register("fullName")} autoComplete="name" />
          <FieldError message={form.formState.errors.fullName?.message} />
        </Field>
        <Field label="E-mail">
          <Input type="email" {...form.register("email")} autoComplete="email" />
          <FieldError message={form.formState.errors.email?.message} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="CPF">
            <Input
              {...form.register("cpf")}
              inputMode="numeric"
              placeholder="000.000.000-00"
              onChange={(event) => form.setValue("cpf", formatCpf(event.target.value), { shouldValidate: true })}
            />
            <FieldError message={form.formState.errors.cpf?.message} />
          </Field>
          <Field label="Data de nascimento">
            <Input type="date" {...form.register("birthDate")} />
            <FieldError message={form.formState.errors.birthDate?.message} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Senha">
            <Input type="password" {...form.register("password")} autoComplete="new-password" />
            <FieldError message={form.formState.errors.password?.message} />
          </Field>
          <Field label="Confirmar senha">
            <Input type="password" {...form.register("confirmPassword")} autoComplete="new-password" />
            <FieldError message={form.formState.errors.confirmPassword?.message} />
          </Field>
        </div>
        <Button disabled={pending} data-testid="signup-submit">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Criar cadastro
        </Button>
        {message ? <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">{message}</p> : null}
      </form>
    </AuthModal>
  );
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "", birthDate: "" },
  });

  async function submit(values: ForgotPasswordValues) {
    setPending(true);
    setMessage(null);
    await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    setPending(false);
    setMessage("Se os dados estiverem corretos, enviaremos instrucoes para redefinir sua senha.");
  }

  return (
    <AuthModal title="Esqueci minha senha" description="Confirme seus dados para receber o link de redefinicao." onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(submit)} data-testid="forgot-password-form">
        <Field label="E-mail">
          <Input type="email" {...form.register("email")} autoComplete="email" />
          <FieldError message={form.formState.errors.email?.message} />
        </Field>
        <Field label="Data de nascimento">
          <Input type="date" {...form.register("birthDate")} />
          <FieldError message={form.formState.errors.birthDate?.message} />
        </Field>
        <Button disabled={pending} data-testid="forgot-password-submit">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Confirmar
        </Button>
        {message ? <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">{message}</p> : null}
      </form>
    </AuthModal>
  );
}

function AuthModal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
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

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
