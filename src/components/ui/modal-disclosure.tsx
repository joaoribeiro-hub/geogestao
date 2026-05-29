"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModalDisclosure({
  trigger,
  title,
  description,
  children,
  closeEventName,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  closeEventName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!closeEventName) return;
    const listener = () => setOpen(false);
    window.addEventListener(closeEventName, listener);
    return () => window.removeEventListener(closeEventName, listener);
  }, [closeEventName]);

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-4">
              <div>
                <h2 className="font-semibold">{title}</h2>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="p-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
