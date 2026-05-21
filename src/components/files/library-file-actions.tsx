"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, Trash2, X } from "lucide-react";
import {
  deleteDocumentTemplateAction,
  getDocumentTemplateSignedUrlAction,
} from "@/app/(app)/documentos/actions";
import {
  deleteLegislationAction,
  getLegislationSignedUrlAction,
} from "@/app/(app)/legislacao/actions";
import { Button } from "@/components/ui/button";

type LibraryFileKind = "document" | "legislation";

export function LibraryFileActions({
  id,
  kind,
  fileName,
  mimeType,
  canDelete,
}: {
  id: string;
  kind: LibraryFileKind;
  fileName?: string | null;
  mimeType?: string | null;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function getUrl() {
    return kind === "document"
      ? getDocumentTemplateSignedUrlAction(id)
      : getLegislationSignedUrlAction(id);
  }

  function view() {
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          setPreviewUrl(await getUrl());
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
          window.open(await getUrl(), "_blank", "noopener,noreferrer");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel baixar.");
        }
      })();
    });
  }

  function remove() {
    if (!window.confirm("Apagar este arquivo? O registro e o arquivo no Storage serao removidos.")) {
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          if (kind === "document") {
            await deleteDocumentTemplateAction(id);
          } else {
            await deleteLegislationAction(id);
          }
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nao foi possivel apagar.");
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
        {canDelete ? (
          <Button type="button" size="sm" variant="destructive" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden="true" />
            Apagar
          </Button>
        ) : null}
      </div>
      {message ? <p className="max-w-xs text-right text-xs text-destructive">{message}</p> : null}
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
              <iframe title="Preview do arquivo" src={previewUrl} className="h-[75vh] w-full bg-background" />
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
