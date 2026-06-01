"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { ClientForm } from "@/components/forms/client-form";
import { Button } from "@/components/ui/button";
import { isConcludedServiceColumn } from "@/lib/services/service-period";
import { formatBrlCurrency, getServiceEstimatedValue } from "@/lib/services/service-finance";
import type { Client, Revenue, ServiceCard, ServiceColumn } from "@/types/database";

type ClientService = ServiceCard & {
  column?: Pick<ServiceColumn, "id" | "slug" | "name"> | null;
};

export function ClientEditModal({ client }: { client: Client }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Pencil aria-hidden="true" />
        Editar
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Editar cliente</h2>
                <p className="text-sm text-muted-foreground">Atualize os dados cadastrais deste cliente.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="p-5">
              <ClientForm
                client={client}
                onSaved={() => {
                  setOpen(false);
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

export function ClientFinancePanel({
  services,
  revenues,
}: {
  services: ClientService[];
  revenues: Revenue[];
}) {
  const [selected, setSelected] = useState("active");
  const activeServices = useMemo(
    () => services.filter((service) => !isConcludedServiceColumn(service.column)),
    [services],
  );
  const selectedServices = selected === "active"
    ? activeServices
    : services.filter((service) => service.id === selected);
  const selectedIds = new Set(selectedServices.map((service) => service.id));
  const selectedRevenues = revenues.filter((revenue) => revenue.service_card_id && selectedIds.has(revenue.service_card_id));
  const combinedTotal = selectedServices.reduce((sum, service) => sum + getServiceEstimatedValue(service), 0);
  const receivedTotal = selectedRevenues
    .filter((revenue) => revenue.status === "paid")
    .reduce((sum, revenue) => sum + Number(revenue.amount ?? 0), 0);
  const selectedService = selected !== "active" ? services.find((service) => service.id === selected) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <FinanceInfo label="Valor combinado total" value={formatBrlCurrency(combinedTotal)} />
        <FinanceInfo label="Valores recebidos" value={formatBrlCurrency(receivedTotal)} />
        <FinanceInfo label="Valores a receber" value={formatBrlCurrency(Math.max(combinedTotal - receivedTotal, 0))} />
        <FinanceInfo label="Servicos vinculados" value={String(selectedServices.length)} />
      </div>

      <div className="rounded-md border bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">Filtro de servicos</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={selected === "active" ? "default" : "outline"}
            onClick={() => setSelected("active")}
          >
            Servicos ativos
          </Button>
          {services.map((service) => (
            <Button
              key={service.id}
              type="button"
              size="sm"
              variant={selected === service.id ? "default" : "outline"}
              onClick={() => setSelected(service.id)}
            >
              {service.title}
            </Button>
          ))}
        </div>
        {selectedService ? (
          <Link href={`/servicos/${selectedService.id}`} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
            Abrir {selectedService.title}
          </Link>
        ) : null}
      </div>

      {selectedServices.length ? (
        <div className="space-y-2">
          {selectedServices.map((service) => {
            const serviceReceived = revenues
              .filter((revenue) => revenue.service_card_id === service.id && revenue.status === "paid")
              .reduce((sum, revenue) => sum + Number(revenue.amount ?? 0), 0);
            const serviceValue = getServiceEstimatedValue(service);
            return (
              <div key={service.id} className="rounded-md border bg-background p-3 text-sm">
                <Link href={`/servicos/${service.id}`} className="font-medium text-primary hover:underline">
                  {service.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatBrlCurrency(serviceValue)} combinado - {formatBrlCurrency(serviceReceived)} recebido - {formatBrlCurrency(Math.max(serviceValue - serviceReceived, 0))} a receber
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
          Nenhum servico encontrado para este filtro.
        </p>
      )}
    </div>
  );
}

function FinanceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
