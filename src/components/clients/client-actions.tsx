"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, Trash2, X } from "lucide-react";
import { deleteClientAction } from "@/app/(app)/clientes/actions";
import { ClientForm } from "@/components/forms/client-form";
import { Button } from "@/components/ui/button";
import type { Client } from "@/types/database";

export function ClientActions({ client }: { client: Client }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (
      !window.confirm(
        "Apagar este cliente?\n\nSe houver servicos vinculados, o GeoGestao vai bloquear a exclusao. Cliente e documentos sao apagados somente da organizacao atual.",
      )
    ) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          await deleteClientAction(client.id);
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel apagar o cliente.");
        }
      })();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/clientes/${client.id}`}>
            <Eye aria-hidden="true" />
            Visualizar
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil aria-hidden="true" />
          Editar
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={remove} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          Apagar
        </Button>
      </div>
      {message ? <p className="max-w-sm text-right text-xs text-destructive">{message}</p> : null}

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Editar cliente"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Editar cliente</h2>
                <p className="text-sm text-muted-foreground">
                  Atualize os dados cadastrais da base de clientes da organizacao atual.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditOpen(false)}
                aria-label="Fechar"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="p-5">
              <ClientForm
                client={client}
                onSaved={() => {
                  setEditOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
