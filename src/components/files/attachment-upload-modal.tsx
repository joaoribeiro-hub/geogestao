"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { AttachmentUploader, type AttachmentEntityOption } from "@/components/forms/attachment-uploader";
import { Button } from "@/components/ui/button";

export function AttachmentUploadModal({
  entities,
  label = "Anexar arquivo",
}: {
  entities: AttachmentEntityOption[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {label}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">{label}</h2>
                <p className="text-sm text-muted-foreground">
                  O arquivo sera salvo na pasta segura da organizacao atual.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="p-5">
              <AttachmentUploader entities={entities} onUploaded={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
