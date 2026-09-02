"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Megaphone, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildUniversalAnnouncementPath,
  UNIVERSAL_CONTENT_BUCKET,
  validateUniversalFile,
} from "@/lib/platform/universal-content";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function UniversalAnnouncementModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(formData: FormData) {
    const file = fileRef.current?.files?.[0] ?? null;
    if (file) {
      const validation = validateUniversalFile({ size: file.size, type: file.type });
      if (validation) { setMessage(validation); return; }
    }
    const id = crypto.randomUUID();
    const path = file ? buildUniversalAnnouncementPath(id, file.name) : null;
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const supabase = createBrowserSupabase();
        if (file && path) {
          const upload = await supabase.storage.from(UNIVERSAL_CONTENT_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
          if (upload.error) { setMessage(upload.error.message); return; }
        }
        const response = await fetch("/api/universal-announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            title: String(formData.get("title") ?? ""),
            body: String(formData.get("body") ?? ""),
            attachment: file && path ? { bucket: UNIVERSAL_CONTENT_BUCKET, path, fileName: file.name, mimeType: file.type || null, size: file.size } : null,
          }),
        });
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          if (path) await supabase.storage.from(UNIVERSAL_CONTENT_BUCKET).remove([path]);
          setMessage(body?.error ?? "Nao foi possivel publicar o aviso.");
          return;
        }
        if (fileRef.current) fileRef.current.value = "";
        setOpen(false);
        window.dispatchEvent(new Event("geogestao:notifications-refresh"));
      })();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}><Megaphone aria-hidden="true" />Criar notificacao universal</Button>
      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-label="Criar notificacao universal">
          <div className="w-full max-w-xl rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">Criar notificacao universal</h2><p className="text-sm text-muted-foreground">O aviso ativo aparecera para usuarios atuais e futuros.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar"><X aria-hidden="true" /></Button></div>
            <form action={submit} className="grid gap-4 p-5">
              <Field label="Titulo"><Input name="title" required maxLength={240} /></Field>
              <Field label="Mensagem"><Textarea name="body" required maxLength={8000} /></Field>
              <Field label="Arquivo opcional"><input ref={fileRef} type="file" className="text-sm" /></Field>
              {message ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{message}</p> : null}
              <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}Publicar aviso</Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
