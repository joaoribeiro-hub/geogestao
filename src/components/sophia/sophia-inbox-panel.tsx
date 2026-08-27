"use client";

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Eye, FileText, Loader2, Play, RefreshCw, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type InboxItem = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  status: string;
  classification: Record<string, unknown>;
  confidence: number | null;
  suggested_entity_type: string | null;
  document_id?: string | null;
  created_at: string;
  error_message?: string | null;
};
type Detail = {
  document?: { processing_status?: string; extracted_text?: string | null; pages?: number | null } | null;
  chunks?: Array<{ id: string; page_start?: number | null; text?: string; content?: string }>;
  summary?: { summary: string; provider?: string | null } | null;
};
const FILTERS = [["all", "Todos"], ["pending", "Pendentes"], ["processed", "Processados"], ["error", "Erros"]] as const;

export function SophiaInboxPanel() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => { void loadItems(); }, []);
  async function loadItems() {
    const response = await fetch("/api/sophia/inbox", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { items?: InboxItem[]; error?: string } | null;
    if (data?.items) setItems(data.items);
    if (data?.error) setMessage(data.error);
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] ?? null); setMessage(null); }
  function upload() {
    if (!file || pending) return;
    const formData = new FormData(); formData.append("file", file);
    startTransition(() => { void (async () => {
      const response = await fetch("/api/sophia/inbox", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { item?: InboxItem; error?: string } | null;
      if (!response.ok || data?.error) { setMessage(data?.error ?? "Nao foi possivel enviar o arquivo."); return; }
      setFile(null); setMessage("Arquivo armazenado. Clique em Processar documento quando quiser iniciar a leitura."); await loadItems();
    })(); });
  }
  function processItem(id: string) {
    if (pending) return;
    startTransition(() => { void (async () => {
      const response = await fetch(`/api/sophia/inbox/${id}/process`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Processamento concluido. Atualizando resultado." : data?.error ?? "Nao foi possivel processar o documento."); await loadItems();
    })(); });
  }
  async function showDetail(id: string) {
    if (detailId === id) { setDetailId(null); setDetail(null); return; }
    setDetailId(id); const response = await fetch(`/api/sophia/inbox/${id}`, { cache: "no-store" }); setDetail((await response.json().catch(() => null)) as Detail | null);
  }
  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesSearch = !query.trim() || `${item.original_name} ${item.status}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "pending" && ["uploaded", "needs_processing", "needs_confirmation", "processing"].includes(item.status)) || (filter === "processed" && ["processed", "organized"].includes(item.status)) || (filter === "error" && ["error", "failed"].includes(item.status));
    return matchesSearch && matchesFilter;
  }), [filter, items, query]);

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" aria-hidden="true" />Documentos da Sophia</CardTitle><p className="text-sm text-muted-foreground">Arquivos permanecem no Storage privado. A leitura e o OCR só começam quando você aciona o processamento.</p><div className="flex flex-wrap items-center gap-2 pt-2">{FILTERS.map(([value, label]) => <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{label}</Button>)}<div className="relative ml-auto min-w-[190px] flex-1 sm:flex-none"><Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar arquivo" className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm" /></div><Button type="button" size="icon" variant="outline" title="Atualizar" aria-label="Atualizar documentos" onClick={() => void loadItems()}><RefreshCw className="size-4" aria-hidden="true" /></Button></div></CardHeader>
      <CardContent className="space-y-3">{visibleItems.length ? visibleItems.map((item) => <div key={item.id} className="rounded-md border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{item.original_name}</p><p className="text-xs text-muted-foreground">{labelStatus(item.status)} · {item.mime_type ?? "tipo nao informado"} · {new Date(item.created_at).toLocaleString("pt-BR")}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">{Math.round((item.confidence ?? 0) * 100)}%</span></div><p className="mt-2 text-xs text-muted-foreground">Tipo: {String(item.classification.documentType ?? "a classificar")} · Origem: {String(item.suggested_entity_type ?? "empresa")}</p>{item.error_message ? <p className="mt-2 flex items-start gap-1 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />{item.error_message}</p> : null}<div className="mt-3 flex flex-wrap gap-2">{["uploaded", "needs_processing", "needs_confirmation", "error", "failed"].includes(item.status) ? <Button type="button" size="sm" variant="outline" onClick={() => processItem(item.id)} disabled={pending}><Play aria-hidden="true" />Processar documento</Button> : null}<Button type="button" size="sm" variant="ghost" onClick={() => void showDetail(item.id)}><Eye aria-hidden="true" />{detailId === item.id ? "Ocultar resultado" : "Ver resultado"}</Button></div>{detailId === item.id && detail ? <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-sm"><p><strong>Processamento:</strong> {labelStatus(detail.document?.processing_status ?? item.status)} · {detail.document?.pages ?? 0} página(s) · {detail.chunks?.length ?? 0} trecho(s)</p>{detail.summary?.summary ? <p><strong>Resumo:</strong> {detail.summary.summary}</p> : null}{detail.chunks?.slice(0, 3).map((chunk) => <p key={chunk.id} className="border-l-2 border-primary pl-2 text-xs text-muted-foreground">{chunk.page_start ? `p. ${chunk.page_start}: ` : ""}{(chunk.content ?? chunk.text ?? "").slice(0, 360)}</p>)}</div> : null}</div>) : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nenhum documento nesta categoria.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Enviar arquivo</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xs text-muted-foreground">PDF, DOCX, TXT, JPG, PNG e WebP até 50 MB.</p><input type="file" accept="application/pdf,.pdf,.docx,.txt,.csv,.md,image/jpeg,image/png,image/webp" onChange={handleFile} className="w-full text-sm" /><Button type="button" onClick={upload} disabled={!file || pending} className="w-full">{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}Armazenar documento</Button>{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}</CardContent></Card>
  </div>;
}

function labelStatus(status: string) { return ({ uploaded: "Enviado", needs_processing: "Pendente", processing: "Processando", processed: "Processado", organized: "Processado", failed: "Erro", error: "Erro", needs_confirmation: "Pendente", concluido: "Concluido", processando: "Processando", erro: "Erro" } as Record<string, string>)[status] ?? status; }
