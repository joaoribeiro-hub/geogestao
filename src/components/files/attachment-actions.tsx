"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, Pencil, Trash2, X } from "lucide-react";
import {
  deleteAttachmentAction,
  getAttachmentSignedUrlAction,
  prepareAttachmentUploadAction,
  updateAttachmentAction,
} from "@/app/(app)/anexos/actions";
import {
  clientDocumentNameOptions,
  resolveClientDocumentName,
  splitClientDocumentName,
} from "@/lib/services/client-documents";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { AttachmentEntityType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AttachmentActions({
  id,
  fileName,
  mimeType,
  category,
  entityType,
  entityId,
  canDelete = true,
  canEdit = false,
}: {
  id: string;
  fileName?: string | null;
  mimeType?: string | null;
  category?: string | null;
  entityType?: AttachmentEntityType;
  entityId?: string;
  canDelete?: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const initialDocumentName = splitClientDocumentName(category);
  const [documentName, setDocumentName] = useState(initialDocumentName.selectedName);
  const [customDocumentName, setCustomDocumentName] = useState(initialDocumentName.customName);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function view() {
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          setPreviewUrl(await getAttachmentSignedUrlAction(id));
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel visualizar.");
        }
      })();
    });
  }

  function download() {
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          window.open(await getAttachmentSignedUrlAction(id), "_blank", "noopener,noreferrer");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel baixar.");
        }
      })();
    });
  }

  function remove() {
    if (!window.confirm("Apagar este anexo? O registro e o arquivo no Storage serao removidos.")) {
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          await deleteAttachmentAction(id);
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel apagar.");
        }
      })();
    });
  }

  function saveEdit(formData: FormData) {
    const file = formData.get("file");
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          if (entityType === "client") {
            formData.set(
              "category",
              resolveClientDocumentName({
                selectedName: documentName,
                customName: customDocumentName,
              }),
            );
          }
          if (file instanceof File && file.size > 0) {
            if (!entityType || !entityId) throw new Error("Registro vinculado nao encontrado.");
            const prepared = await prepareAttachmentUploadAction({
              entityType,
              entityId,
              fileName: file.name,
              sizeBytes: file.size,
            });
            const supabase = createBrowserSupabase();
            const { error: uploadError } = await supabase.storage
              .from(prepared.bucket)
              .upload(prepared.filePath, file, {
                upsert: false,
                contentType: file.type,
              });
            if (uploadError) throw new Error(uploadError.message);
            formData.set("storage_path", prepared.filePath);
            formData.set("file_path", prepared.filePath);
            formData.set("file_name", file.name);
            formData.set("mime_type", file.type);
            formData.set("size_bytes", file.size.toString());
          }
          formData.delete("file");
          await updateAttachmentAction(id, formData);
          setEditOpen(false);
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel editar.");
        }
      })();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={view} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}
          Visualizar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={download} disabled={pending}>
          <Download aria-hidden="true" />
          Baixar
        </Button>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={pending}>
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" size="sm" variant="destructive" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden="true" />
            Apagar
          </Button>
        ) : null}
      </div>
      {message ? <p className="max-w-xs text-right text-xs text-destructive">{message}</p> : null}
      {editOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4">
          <div className="w-full max-w-xl rounded-lg border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b p-4">
              <h2 className="font-semibold">Editar anexo</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setEditOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            <form action={saveEdit} className="grid gap-4 p-5">
              {entityType === "client" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do documento</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={documentName}
                      onChange={(event) => setDocumentName(event.target.value)}
                    >
                      {clientDocumentNameOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {documentName === "Outros" ? (
                    <div className="space-y-2">
                      <Label>Nome personalizado</Label>
                      <Input
                        value={customDocumentName}
                        onChange={(event) => setCustomDocumentName(event.target.value)}
                        placeholder="Ex.: Certidao municipal"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Tipo/observacao</Label>
                  <Input name="category" defaultValue={category ?? ""} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Substituir arquivo</Label>
                <input name="file" type="file" className="text-sm" />
              </div>
              <Button disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                Salvar alteracoes
              </Button>
            </form>
          </div>
        </div>
      ) : null}
      {previewUrl ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b p-4">
              <div>
                <h2 className="font-semibold">{fileName ?? "Arquivo"}</h2>
                <p className="text-xs text-muted-foreground">{mimeType ?? "arquivo"}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setPreviewUrl(null)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>
            {mimeType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={fileName ?? "Preview"} className="max-h-[75vh] object-contain p-4" />
            ) : mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf") ? (
              <iframe title="Preview do anexo" src={previewUrl} className="h-[75vh] w-full bg-background" />
            ) : (
              <div className="grid min-h-64 place-items-center p-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Preview indisponivel para este tipo de arquivo.
                  </p>
                  <Button className="mt-4" type="button" onClick={download}>
                    <Download aria-hidden="true" />
                    Baixar arquivo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
