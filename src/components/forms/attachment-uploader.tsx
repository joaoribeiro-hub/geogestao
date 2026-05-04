"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { registerAttachmentAction } from "@/app/(app)/anexos/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { AttachmentEntityType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type AttachmentEntityOption = {
  id: string;
  type: AttachmentEntityType;
  label: string;
};

const entityLabels: Record<AttachmentEntityType, string> = {
  client: "Cliente",
  proposal: "Proposta",
  service_card: "Card de servico",
  contract: "Contrato",
  revenue: "Receita",
  expense: "Despesa",
  document_template: "Documento",
  legislation_item: "Legislacao",
};

export function AttachmentUploader({ entities }: { entities: AttachmentEntityOption[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [entityType, setEntityType] = useState<AttachmentEntityType>("client");
  const filtered = useMemo(
    () => entities.filter((entity) => entity.type === entityType),
    [entities, entityType],
  );
  const [entityId, setEntityId] = useState(filtered[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload() {
    const file = fileRef.current?.files?.[0];
    const selectedId = entityId || filtered[0]?.id;
    if (!file || !selectedId) {
      setMessage("Selecione uma entidade e um arquivo.");
      return;
    }

    const supabase = createBrowserSupabase();
    const safeName = file.name.replace(/[^\w.-]+/g, "-");
    const filePath = `${entityType}/${selectedId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("attachments").upload(filePath, file);
    if (error) {
      setMessage(error.message);
      return;
    }

    const formData = new FormData();
    formData.set("entity_type", entityType);
    formData.set("entity_id", selectedId);
    formData.set("file_path", filePath);
    formData.set("file_name", file.name);
    formData.set("mime_type", file.type);
    formData.set("size_bytes", file.size.toString());

    startTransition(() => {
      void registerAttachmentAction(formData);
      setMessage("Arquivo enviado.");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={entityType}
            onChange={(event) => {
              const value = event.target.value as AttachmentEntityType;
              setEntityType(value);
              const next = entities.find((entity) => entity.type === value)?.id ?? "";
              setEntityId(next);
            }}
          >
            {Object.entries(entityLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Registro</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
          >
            {filtered.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input ref={fileRef} type="file" className="text-sm" />
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button type="button" onClick={upload} disabled={pending || !filtered.length}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
        Enviar anexo
      </Button>
    </div>
  );
}
