"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDisclosure } from "@/components/ui/modal-disclosure";

type ImportPreview = {
  externalId: string | null;
  title: string;
  description: string | null;
  listName: string | null;
  columnName: string;
  priority: string;
  labels: string | null;
  dueDate: string | null;
  duplicate: boolean;
  fallback?: boolean;
};

type ImportResult = {
  totalRows: number;
  importableCount: number;
  duplicateCount: number;
  importedCount: number;
  preview: ImportPreview[];
  error?: string;
};

export function ServiceImportModal({
  selectedBoardId,
}: {
  selectedBoardId: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(dryRun: boolean) {
    const file = fileRef.current?.files?.[0];
    if (!file || !selectedBoardId) {
      setMessage("Selecione uma planilha e um quadro de servicos.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("boardId", selectedBoardId);
    formData.set("dryRun", dryRun ? "true" : "false");
    const response = await fetch("/api/service-import/trello", { method: "POST", body: formData });
    const data = (await response.json().catch(() => null)) as ImportResult | null;
    setLoading(false);
    if (!response.ok || data?.error) {
      setMessage(data?.error ?? "Nao foi possivel processar a importacao.");
      return;
    }
    setResult(data);
    if (!dryRun) {
      setMessage(`${data?.importedCount ?? 0} servico(s) importado(s).`);
      window.location.reload();
    }
  }

  return (
    <ModalDisclosure
      title="Importar servicos"
      description="Importe uma planilha .xlsx ou .csv exportada do Trello. A pre-visualizacao nao cria servicos."
      trigger={
        <Button type="button" variant="outline">
          <FileSpreadsheet aria-hidden="true" />
          Importar servicos
        </Button>
      }
    >
      <div className="space-y-4">
        <input ref={fileRef} type="file" accept=".xlsx,.csv" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => submit(true)} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
            Pre-visualizar importacao
          </Button>
          <Button type="button" onClick={() => submit(false)} disabled={loading || !result}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            Confirmar importacao
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {result ? (
          <div className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <Info label="Linhas" value={String(result.totalRows)} />
              <Info label="Importaveis" value={String(result.importableCount)} />
              <Info label="Duplicados" value={String(result.duplicateCount)} />
            </div>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary">
                  <tr>
                    <th className="p-2">Servico</th>
                    <th className="p-2">Descricao</th>
                    <th className="p-2">Labels originais</th>
                    <th className="p-2">Coluna</th>
                    <th className="p-2">Prioridade/Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row) => (
                    <tr key={`${row.externalId}-${row.title}`} className="border-t">
                      <td className="p-2 font-medium">{row.title}</td>
                      <td className="p-2">{row.description ?? "-"}</td>
                      <td className="p-2">{row.labels ?? row.listName ?? "-"}</td>
                      <td className="p-2">
                        {row.columnName}
                        {row.fallback ? <span className="ml-1 text-muted-foreground">(fallback)</span> : null}
                      </td>
                      <td className="p-2">{row.duplicate ? "Ignorado: duplicado" : row.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </ModalDisclosure>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
