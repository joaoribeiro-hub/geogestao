"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { ServiceCardForm } from "@/components/forms/service-card-form";
import { Button } from "@/components/ui/button";
import { serviceTypeToBoardSlug } from "@/lib/services/service-cards";
import type { Client, ProposalServiceType, ServiceColumn } from "@/types/database";

export function NewServiceModal({
  clients,
  columns,
  columnByServiceType,
  members,
}: {
  clients: Client[];
  columns: ServiceColumn[];
  columnByServiceType: Partial<Record<ProposalServiceType, string>>;
  members?: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <Button data-testid="new-service-button" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Novo Servico
        </Button>
        {feedback ? (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            {feedback}
          </p>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Novo Servico"
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Novo Servico</h2>
                <p className="text-sm text-muted-foreground">
                  O servico sera criado na primeira etapa ativa do fluxo. Os checklists
                  de documentos e etapas comecam vazios para voce preencher.
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
              <ServiceCardForm
                clients={clients}
                columns={columns}
                columnByServiceType={columnByServiceType}
                members={members ?? []}
                onCreated={(result) => {
                  setOpen(false);
                  setFeedback("Servico criado na primeira etapa ativa do fluxo.");
                  router.push(`/servicos?board=${serviceTypeToBoardSlug[result.serviceType]}`);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
