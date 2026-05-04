"use client";

import { useTransition } from "react";
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

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmMessage)) {
          startTransition(() => {
            void action();
          });
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
      {label}
    </Button>
  );
}
