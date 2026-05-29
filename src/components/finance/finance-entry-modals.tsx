"use client";

import { useState } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, X } from "lucide-react";
import { FinanceForm, TransferForm } from "@/components/forms/finance-form";
import { Button } from "@/components/ui/button";
import type { Client, Proposal, ServiceCard } from "@/types/database";

export function FinanceEntryModals({
  clients,
  proposals,
  serviceCards,
}: {
  clients: Client[];
  proposals: Proposal[];
  serviceCards: ServiceCard[];
}) {
  const [open, setOpen] = useState<"revenue" | "expense" | "transfer" | null>(null);

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={() => setOpen("revenue")} data-testid="new-revenue-button">
          <ArrowUp aria-hidden="true" />
          Nova Entrada
        </Button>
        <Button
          onClick={() => setOpen("expense")}
          variant="outline"
          data-testid="new-expense-button"
        >
          <ArrowDown aria-hidden="true" />
          Nova Saida
        </Button>
        <Button
          onClick={() => setOpen("transfer")}
          variant="outline"
          data-testid="new-transfer-button"
        >
          <ArrowLeftRight aria-hidden="true" />
          Nova Transferencia
        </Button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={open === "revenue" ? "Nova entrada" : open === "expense" ? "Nova saida" : "Nova transferencia"}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">
                  {open === "revenue" ? "Nova Entrada" : open === "expense" ? "Nova Saida" : "Nova Transferencia"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  O lancamento pode ser vinculado a cliente, proposta, servico e banco/conta.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(null)}
                aria-label="Fechar"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="p-5">
              {open === "transfer" ? (
                <TransferForm onSaved={() => setOpen(null)} />
              ) : (
                <FinanceForm
                  type={open}
                  clients={clients}
                  proposals={proposals}
                  serviceCards={serviceCards}
                  onSaved={() => setOpen(null)}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
