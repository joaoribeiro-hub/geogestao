"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  label = "Excluir",
  confirmMessage,
  action,
}: {
  label?: string;
  confirmMessage: string;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (window.confirm(confirmMessage)) {
            startTransition(() => {
              void (async () => {
                try {
                  setMessage(null);
                  await action();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Nao foi possivel excluir.");
                }
              })();
            });
          }
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
        {label}
      </Button>
      {message ? <p className="max-w-sm text-right text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
