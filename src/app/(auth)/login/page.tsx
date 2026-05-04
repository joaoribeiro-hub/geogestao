import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="app-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-sm font-semibold text-primary">GeoGestao</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">
            Acesse seu escritorio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com o e-mail cadastrado no Supabase Auth.
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
