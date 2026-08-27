"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SophiaChatAttachment = {
  inboxItemId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  source: "sophia_chat";
};

export function SophiaAttachmentInput({
  attachment,
  onUploaded,
  onClear,
  disabled = false,
}: {
  attachment: SophiaChatAttachment | null;
  onUploaded: (attachment: SophiaChatAttachment) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", "sophia_chat");
    const response = await fetch("/api/sophia/inbox", { method: "POST", body: formData }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { attachment?: SophiaChatAttachment; error?: string } | null;
    setPending(false);
    if (!response?.ok || !data?.attachment) {
      setError(data?.error ?? "Nao foi possivel anexar o arquivo.");
      return;
    }
    onUploaded(data.attachment);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <input ref={inputRef} type="file" className="sr-only" onChange={handleFile} disabled={disabled || pending} />
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="Anexar arquivo para a Sophia"
        title="Anexar arquivo"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Paperclip className="size-4" aria-hidden="true" />}
      </Button>
      {attachment ? (
        <span className="flex min-w-0 max-w-[190px] items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs" title={attachment.fileName}>
          <span className="truncate">{attachment.fileName}</span>
          <button type="button" className="shrink-0 rounded p-0.5 hover:bg-background" aria-label="Remover anexo" onClick={onClear}>
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ) : null}
      {error ? <span className="max-w-[180px] truncate text-xs text-destructive" role="alert">{error}</span> : null}
    </div>
  );
}
