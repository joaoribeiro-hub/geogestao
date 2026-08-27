"use client";

import { useState, useTransition } from "react";
import { Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LightweightModeToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    document.querySelector<HTMLElement>('[data-testid="app-shell"]')?.setAttribute("data-lightweight", String(next));
    startTransition(() => {
      void fetch("/api/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lightweightMode: next }),
      }).then((response) => {
        if (!response.ok) {
          setEnabled(!next);
          document.querySelector<HTMLElement>('[data-testid="app-shell"]')?.setAttribute("data-lightweight", String(!next));
        }
      }).catch(() => {
        setEnabled(!next);
        document.querySelector<HTMLElement>('[data-testid="app-shell"]')?.setAttribute("data-lightweight", String(!next));
      });
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={enabled ? "default" : "outline"}
      className="h-9 gap-2 bg-card"
      aria-pressed={enabled}
      aria-label="Alternar Modo leve"
      title="Simplificar o menu principal"
      onClick={toggle}
      disabled={pending}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Leaf className="size-4" aria-hidden="true" />}
      <span>Modo leve</span>
    </Button>
  );
}
