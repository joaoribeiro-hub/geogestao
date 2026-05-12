"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import {
  prepareAvatarUploadAction,
  saveAvatarPathAction,
} from "@/app/(app)/minha-conta/actions";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function AvatarUploader({
  currentUrl,
  currentPath,
}: {
  currentUrl?: string | null;
  currentPath?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? null);
  const [avatarPath, setAvatarPath] = useState(currentPath ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Selecione uma imagem.");
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage(null);
        try {
          const { bucket, filePath } = await prepareAvatarUploadAction({
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          });
          const supabase = createBrowserSupabase();
          const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
            upsert: false,
            contentType: file.type,
          });
          if (error) throw new Error(error.message);

          await saveAvatarPathAction({
            filePath,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          });

          setAvatarPath(filePath);
          setPreviewUrl(URL.createObjectURL(file));
          setMessage("Foto atualizada.");
          if (fileRef.current) fileRef.current.value = "";
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Nao foi possivel enviar a foto.",
          );
        }
      })();
    });
  }

  return (
    <div className="grid gap-4">
      <input name="avatar_path" type="hidden" value={avatarPath} />
      <div className="flex items-center gap-4">
        <div className="relative size-20 overflow-hidden rounded-full border bg-secondary">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Foto de perfil" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-xl font-semibold text-muted-foreground">
              ?
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
          />
          <Button type="button" variant="outline" onClick={upload} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            Enviar foto
          </Button>
        </div>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
