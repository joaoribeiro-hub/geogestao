"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Search, Trash2, Upload } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModalDisclosure } from "@/components/ui/modal-disclosure";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  formatDocumentBytes,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from "@/lib/documents/storage";

type ProfessionalDocument = {
  id: string;
  original_name: string;
  title: string | null;
  document_type: string | null;
  category: string | null;
  description: string | null;
  notes: string | null;
  size_bytes: number;
  mime_type: string | null;
  upload_status: string;
  processing_status: string;
  is_global: boolean;
  is_official: boolean;
  created_at: string;
};

type ProfessionalDocumentsPanelProps = {
  title?: string;
  relatedType?: "company" | "client" | "service" | "hr";
  clientId?: string;
  propertyId?: string;
  serviceId?: string;
  employeeId?: string;
};

export function ProfessionalDocumentsPanel({
  title = "Documentos profissionais",
  relatedType = "company",
  clientId,
  propertyId,
  serviceId,
  employeeId,
}: ProfessionalDocumentsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<ProfessionalDocument[]>([]);
  const [query, setQuery] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (clientId) params.set("client_id", clientId);
    if (propertyId) params.set("property_id", propertyId);
    if (serviceId) params.set("service_id", serviceId);
    if (employeeId) params.set("employee_id", employeeId);
    if (relatedType === "company") params.set("related_type", "company");
    return params;
  }, [clientId, employeeId, propertyId, query, relatedType, serviceId]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/documents/search?${buildParams().toString()}`);
    const data = (await response.json()) as { documents?: ProfessionalDocument[]; error?: string };
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error ?? "Nao foi possivel carregar documentos.");
      return;
    }
    setDocuments(data.documents ?? []);
  }, [buildParams]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadDocument() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Selecione um arquivo.");
      return;
    }
    if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      setMessage("O arquivo deve ter no maximo 50 MB.");
      return;
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as never)) {
      setMessage("Tipo de arquivo nao permitido para documentos.");
      return;
    }

    setUploading(true);
    setMessage(null);
    const prepareResponse = await fetch("/api/documents/prepare-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        title: documentTitle,
        documentType,
        category,
        description,
        notes,
        clientId,
        propertyId,
        serviceId,
        employeeId,
        relatedType,
      }),
    });
    const prepared = (await prepareResponse.json()) as {
      documentId?: string;
      bucket?: string;
      storagePath?: string;
      error?: string;
    };
    if (!prepareResponse.ok || !prepared.documentId || !prepared.bucket || !prepared.storagePath) {
      setUploading(false);
      setMessage(prepared.error ?? "Nao foi possivel preparar o upload.");
      return;
    }

    const supabase = createBrowserSupabase();
    const { error: uploadError } = await supabase.storage
      .from(prepared.bucket)
      .upload(prepared.storagePath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      await fetch("/api/documents/cancel-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: prepared.documentId }),
      });
      setUploading(false);
      setMessage(uploadError.message);
      return;
    }

    const confirmResponse = await fetch("/api/documents/confirm-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: prepared.documentId }),
    });
    const confirmed = (await confirmResponse.json()) as { error?: string };
    setUploading(false);
    if (!confirmResponse.ok) {
      setMessage(confirmed.error ?? "Upload enviado, mas nao foi possivel confirmar o documento.");
      return;
    }

    if (fileRef.current) fileRef.current.value = "";
    setDocumentTitle("");
    setDocumentType("");
    setCategory("");
    setDescription("");
    setNotes("");
    setMessage("Documento enviado com seguranca.");
    window.dispatchEvent(new Event("professional-document-uploaded"));
    await loadDocuments();
  }

  async function downloadDocument(documentId: string) {
    const response = await fetch(`/api/documents/${documentId}/download`);
    const data = (await response.json()) as { signedUrl?: string; error?: string };
    if (!response.ok || !data.signedUrl) {
      setMessage(data.error ?? "Nao foi possivel gerar link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeDocument(documentId: string) {
    if (!window.confirm("Apagar este documento? O registro sera removido da lista e o arquivo sera removido do Storage.")) {
      return;
    }
    const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Nao foi possivel apagar o documento.");
      return;
    }
    setMessage("Documento removido.");
    await loadDocuments();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <ModalDisclosure
            title="Anexar documento"
            description="Envie um documento privado da organizacao."
            trigger={<Button type="button">+ Anexar documento</Button>}
            closeEventName="professional-document-uploaded"
          >
            <UploadForm
              fileRef={fileRef}
              documentTitle={documentTitle}
              setDocumentTitle={setDocumentTitle}
              documentType={documentType}
              setDocumentType={setDocumentType}
              category={category}
              setCategory={setCategory}
              description={description}
              setDescription={setDescription}
              notes={notes}
              setNotes={setNotes}
              uploading={uploading}
              uploadDocument={uploadDocument}
            />
          </ModalDisclosure>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, tipo, descricao, observacao ou texto extraido" />
          </div>
          <Button type="button" variant="outline" onClick={loadDocuments} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
            Buscar
          </Button>
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {documents.length ? (
          <div className="space-y-2">
            {documents.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                <div>
                  <p className="font-medium">{document.title || document.original_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {document.document_type ?? document.category ?? "Documento"} - {formatDocumentBytes(Number(document.size_bytes ?? 0))} - {formatDate(document.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload: {document.upload_status} - Processamento: {document.processing_status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => downloadDocument(document.id)}>
                    <Download aria-hidden="true" />
                    Baixar
                  </Button>
                  {!document.is_global ? (
                    <Button type="button" size="sm" variant="destructive" onClick={() => removeDocument(document.id)}>
                      <Trash2 aria-hidden="true" />
                      Apagar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhum documento profissional encontrado." />
        )}
      </CardContent>
    </Card>
  );
}

function UploadForm({
  fileRef,
  documentTitle,
  setDocumentTitle,
  documentType,
  setDocumentType,
  category,
  setCategory,
  description,
  setDescription,
  notes,
  setNotes,
  uploading,
  uploadDocument,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  documentTitle: string;
  setDocumentTitle: (value: string) => void;
  documentType: string;
  setDocumentType: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  uploading: boolean;
  uploadDocument: () => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Titulo</Label>
        <Input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Ex.: Matricula atualizada" />
      </div>
      <div className="space-y-2">
        <Label>Tipo do documento</Label>
        <Input value={documentType} onChange={(event) => setDocumentType(event.target.value)} placeholder="Ex.: Matricula, contrato, laudo" />
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ex.: Cliente, Servico, RH" />
      </div>
      <div className="space-y-2">
        <Label>Arquivo</Label>
        <Input ref={fileRef} type="file" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Descricao</Label>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Resumo curto do documento" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Observacoes</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observacoes internas" />
      </div>
      <Button type="button" onClick={uploadDocument} disabled={uploading} className="md:col-span-2">
        {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
        Enviar documento
      </Button>
    </div>
  );
}
