"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Plan } from "@/types/database";

export function PlansModal({
  plans,
  currentPlanId,
}: {
  plans: Plan[];
  currentPlanId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} data-testid="open-plans">
        Ver planos
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-label="Planos">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Planos</h2>
                <p className="text-sm text-muted-foreground">
                  Estrutura preparada para assinaturas futuras. Nao ha cobranca nesta fase.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const isStarter = plan.slug === "iniciante";
                return (
                  <article key={plan.id} className="grid gap-4 rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {plan.description ?? "Plano preparado para fase futura."}
                        </p>
                      </div>
                      {isCurrent ? <Badge>Plano atual</Badge> : null}
                    </div>
                    <div className="grid gap-2 text-sm">
                      <PlanLine label="Mensalidade" value={formatCurrency((plan.price_monthly_cents ?? 0) / 100)} />
                      <PlanLine label="Usuarios" value={`ate ${plan.max_users ?? 3} contas ativas`} />
                      <PlanLine label="Armazenamento" value={`${plan.storage_limit_mb ?? plan.storage_quota_mb ?? 3072} MB`} />
                      <PlanLine label="Assistente IA" value={plan.ai_enabled ? "habilitado" : "indisponivel"} />
                    </div>
                    <Button disabled variant={isCurrent ? "default" : "outline"}>
                      {isCurrent ? (
                        <>
                          <Check aria-hidden="true" />
                          Possuido
                        </>
                      ) : isStarter ? (
                        "Indisponivel"
                      ) : (
                        "Em breve"
                      )}
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PlanLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
