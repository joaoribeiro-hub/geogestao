"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ClientForm } from "@/components/forms/client-form";
import { Button } from "@/components/ui/button";

export function ClientCreateModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="new-client-button">
        <Plus aria-hidden="true" />
        Novo cliente
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Novo cliente"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Novo cliente</h2>
                <p className="text-sm text-muted-foreground">
                  Cadastre a pessoa fisica ou juridica que podera ser usada nos servicos.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="p-5">
              <ClientForm />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

