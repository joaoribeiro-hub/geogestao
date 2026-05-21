"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Upload, X } from "lucide-react";
import {
  createDocumentTemplateAction,
  prepareDocumentTemplateUploadAction,
} from "@/app/(app)/documentos/actions";
import {
  createLegislationAction,
  prepareLegislationUploadAction,
} from "@/app/(app)/legislacao/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LibraryKind = "document" | "legislation";

export function LibraryUploadModal({ kind }: { kind: LibraryKind }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const isDocument = kind === "document";

  async function submit(formData: FormData) {
    const file = fileRef.current?.files?.[0] ?? null;
    setMessage(null);

    startTransition(() => {
      void (async () => {
        try {
          if (file) {
            const prepared = isDocument
              ? await prepareDocumentTemplateUploadAction({
                  fileName: file.name,
                  sizeBytes: file.size,
                })
              : await prepareLegislationUploadAction({
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

            formData.set("bucket", prepared.bucket);
            formData.set("file_path", prepared.filePath);
            formData.set("storage_path", prepared.filePath);
            formData.set("file_name", file.name);
            formData.set("mime_type", file.type);
            formData.set("size_bytes", file.size.toString());
          }

          if (isDocument) {
            await createDocumentTemplateAction(formData);
          } else {
            await createLegislationAction(formData);
          }

          setOpen(false);
          if (fileRef.current) fileRef.current.value = "";
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel anexar o arquivo.");
        }
      })();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Anexar arquivo
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={isDocument ? "Anexar documento" : "Anexar legislacao"}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">
                  {isDocument ? "Anexar documento" : "Anexar legislacao"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  O arquivo sera salvo no Storage da organizacao atual.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </Button>
            </div>

            <form action={submit} className="grid gap-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Titulo">
                  <Input name="title" required />
                </Field>
                <Field label="Categoria">
                  <Input name="category" required />
                </Field>
              </div>

              {isDocument ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Versao">
                    <Input name="version" defaultValue="1.0" required />
                  </Field>
                  <Field label="Status">
                    <select
                      name="status"
                      defaultValue="vigente"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="vigente">Vigente</option>
                      <option value="obsoleto">Obsoleto</option>
                    </select>
                  </Field>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Status">
                      <select
                        name="status"
                        defaultValue="vigente"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="vigente">Vigente</option>
                        <option value="atencao">Requer atencao</option>
                        <option value="revogado">Revogado</option>
                      </select>
                    </Field>
                    <Field label="Link oficial">
                      <Input name="official_link" type="url" />
                    </Field>
                  </div>
                  <Field label="Resumo tecnico">
                    <Textarea name="technical_summary" />
                  </Field>
                </>
              )}

              <Field label={isDocument ? "Descricao" : "Pontos praticos"}>
                <Textarea name={isDocument ? "description" : "practical_points"} />
              </Field>

              <Field label="Arquivo">
                <input ref={fileRef} type="file" className="text-sm" />
              </Field>

              {message ? (
                <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{message}</p>
              ) : null}

              <Button disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {isDocument ? "Criar documento" : "Criar legislacao"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
