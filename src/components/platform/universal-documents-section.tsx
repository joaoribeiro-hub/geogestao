"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Download, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildUniversalDocumentPath,
  type UniversalDocumentCategory,
  UNIVERSAL_CONTENT_BUCKET,
  validateUniversalFile,
} from "@/lib/platform/universal-content";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/utils";

type UniversalDocument = {
  id: string;
  title: string;
  description: string | null;
  category: UniversalDocumentCategory;
  file_name: string;
  mime_type: string | null;
  file_size: number;
  published_at: string;
};

export function UniversalDocumentsSection({
  category,
  isPlatformDeveloper,
}: {
  category: UniversalDocumentCategory;
  isPlatformDeveloper: boolean;
}) {
  const [documents, setDocuments] = useState<UniversalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UniversalDocument | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/universal-documents?category=${category}`, { cache: "no-store" });
    const body = await response.json().catch(() => null) as { documents?: UniversalDocument[]; error?: string } | null;
    if (!response.ok) setMessage(body?.error ?? "Nao foi possivel carregar os documentos universais.");
    else setDocuments(body?.documents ?? []);
    setLoading(false);
  }, [category]);

  useEffect(() => { void load(); }, [load]);

  async function submit(formData: FormData) {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file) { setMessage("Selecione um arquivo."); return; }
    const fileError = validateUniversalFile({ size: file.size, type: file.type });
    if (fileError) { setMessage(fileError); return; }
    const documentId = crypto.randomUUID();
    const path = buildUniversalDocumentPath(category, documentId, file.name);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        const supabase = createBrowserSupabase();
        const upload = await supabase.storage.from(UNIVERSAL_CONTENT_BUCKET).upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (upload.error) { setMessage(upload.error.message); return; }
        const response = await fetch("/api/universal-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: documentId,
            title: String(formData.get("title") ?? ""),
            description: String(formData.get("description") ?? ""),
            category,
            storageBucket: UNIVERSAL_CONTENT_BUCKET,
            storagePath: path,
            fileName: file.name,
            mimeType: file.type || null,
            fileSize: file.size,
          }),
        });
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          await supabase.storage.from(UNIVERSAL_CONTENT_BUCKET).remove([path]);
          setMessage(body?.error ?? "Nao foi possivel publicar o documento universal.");
          return;
        }
        if (fileRef.current) fileRef.current.value = "";
        setOpen(false);
        await load();
      })();
    });
  }

  async function download(document: UniversalDocument) {
    const response = await fetch(`/api/universal-documents/${document.id}/download`, { cache: "no-store" });
    const body = await response.json().catch(() => null) as { url?: string; error?: string } | null;
    if (!response.ok || !body?.url) { setMessage(body?.error ?? "Download indisponivel."); return; }
    window.location.assign(body.url);
  }

  async function remove(document: UniversalDocument) {
    if (!window.confirm(`Remover o documento universal "${document.title}"?`)) return;
    const response = await fetch(`/api/universal-documents/${document.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setMessage(body?.error ?? "Nao foi possivel remover o documento."); return; }
    await load();
  }

  async function updateDocument(formData: FormData) {
    if (!editing) return;
    const response = await fetch(`/api/universal-documents/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: String(formData.get("title") ?? ""), description: String(formData.get("description") ?? "") }),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setMessage(body?.error ?? "Nao foi possivel editar o documento."); return; }
    setEditing(null);
    await load();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Documentos universais</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Conteudo publicado pela plataforma para todas as organizacoes.</p>
          </div>
          {isPlatformDeveloper ? <Button onClick={() => setOpen(true)}><Plus aria-hidden="true" />Anexar documento universal</Button> : null}
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando...</div> : documents.length ? (
            <div className="divide-y rounded-md border">
              {documents.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><FileText className="size-4" aria-hidden="true" /><p className="font-medium">{document.title}</p><Badge variant="outline">Universal</Badge></div>
                    {document.description ? <p className="mt-1 text-sm text-muted-foreground">{document.description}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">{document.file_name} · {formatBytes(document.file_size)} · {formatDate(document.published_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void download(document)}><Download aria-hidden="true" />Baixar</Button>
                    {isPlatformDeveloper ? <><Button type="button" size="icon" variant="ghost" aria-label="Editar documento universal" onClick={() => setEditing(document)}><Pencil aria-hidden="true" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Remover documento universal" onClick={() => void remove(document)}><Trash2 aria-hidden="true" /></Button></> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Nenhum documento universal publicado nesta categoria." />}
          {message ? <p className="mt-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{message}</p> : null}
        </CardContent>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-label="Anexar documento universal">
          <div className="w-full max-w-2xl rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">Anexar documento universal</h2><p className="text-sm text-muted-foreground">O arquivo ficara disponivel para todos os usuarios autenticados.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar"><X aria-hidden="true" /></Button></div>
            <form action={submit} className="grid gap-4 p-5">
              <Field label="Titulo"><Input name="title" required maxLength={240} /></Field>
              <Field label="Descricao"><Textarea name="description" maxLength={4000} /></Field>
              <Field label="Arquivo"><input ref={fileRef} type="file" required className="text-sm" /></Field>
              {message ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{message}</p> : null}
              <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}Publicar</Button>
            </form>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-label="Editar documento universal">
          <div className="w-full max-w-xl rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">Editar documento universal</h2><p className="text-sm text-muted-foreground">O arquivo armazenado sera preservado.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label="Fechar"><X aria-hidden="true" /></Button></div>
            <form action={updateDocument} className="grid gap-4 p-5">
              <Field label="Titulo"><Input name="title" required maxLength={240} defaultValue={editing.title} /></Field>
              <Field label="Descricao"><Textarea name="description" maxLength={4000} defaultValue={editing.description ?? ""} /></Field>
              <Button>Salvar alteracoes</Button>
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

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
