"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { resetPasswordSchema } from "@/lib/auth-validation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const supabase = createBrowserSupabase();

    void (async () => {
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("O link de redefinicao expirou ou e invalido. Solicite um novo link.");
          setReady(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Abra esta pagina pelo link enviado no e-mail de redefinicao.");
        setReady(false);
        return;
      }

      setReady(true);
    })();
  }, [params]);

  async function submit(values: ResetPasswordValues) {
    setPending(true);
    setError(null);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });
    setPending(false);

    if (updateError) {
      setError("Nao foi possivel redefinir a senha. Solicite um novo link e tente novamente.");
      return;
    }

    setMessage("Senha redefinida com sucesso.");
    await supabase.auth.signOut();
    router.replace("/login?passwordReset=1");
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)} data-testid="reset-password-form">
      {error ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          disabled={!ready || pending}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
        <Input
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          disabled={!ready || pending}
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <Button disabled={!ready || pending} data-testid="reset-password-submit">
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Confirmar
      </Button>
    </form>
  );
}
