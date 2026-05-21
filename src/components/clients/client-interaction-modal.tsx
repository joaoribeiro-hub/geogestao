"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { InteractionForm } from "@/components/forms/interaction-form";
import { Button } from "@/components/ui/button";

export function ClientInteractionModal({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Nova interacao
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Nova interacao"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Nova interacao</h2>
                <p className="text-sm text-muted-foreground">Registre um contato ou observacao no historico.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="p-5">
              <InteractionForm clientId={clientId} onSaved={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
