"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LogOut, UserCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function UserAccountMenu({
  name,
  email,
}: {
  name?: string | null;
  email?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const displayName = name?.trim() || email?.split("@")[0] || "Usuario";
  const initials = useMemo(() => makeInitials(displayName, email), [displayName, email]);

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="grid size-10 place-items-center rounded-full border bg-card text-sm font-semibold text-primary shadow-sm transition hover:border-primary"
        aria-label="Abrir menu da conta"
        onClick={() => setOpen((current) => !current)}
      >
        {initials}
      </button>

      {open ? (
        <section className="absolute right-0 top-12 z-50 w-[min(88vw,320px)] rounded-lg border bg-card p-4 text-card-foreground shadow-xl">
          <header className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Conta</p>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar conta" onClick={() => setOpen(false)}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </header>

          <div className="mb-4 flex items-center gap-3 rounded-md bg-secondary/60 p-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Button asChild variant="outline" className="justify-start" onClick={() => setOpen(false)}>
              <Link href="/minha-conta">
                <UserCircle className="size-4" aria-hidden="true" />
                Minha conta
              </Link>
            </Button>
            <Button type="button" variant="outline" className="justify-start" onClick={signOut}>
              <LogOut className="size-4" aria-hidden="true" />
              Fazer logout
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function makeInitials(name: string, email?: string | null) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]?.length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (email?.slice(0, 2) || "US").toUpperCase();
}
