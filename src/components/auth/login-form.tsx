"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "Informe a senha."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    setReady(true);
  }, []);

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

    router.replace(params.get("redirectedFrom") ?? "/");
    router.refresh();
  }

  return (
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
      <Button className="w-full" data-testid="login-submit" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Entrar
      </Button>
    </form>
  );
}
