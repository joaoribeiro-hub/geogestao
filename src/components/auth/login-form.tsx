"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

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
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
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
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>
      {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      <Button className="w-full" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Entrar
      </Button>
    </form>
  );
}
