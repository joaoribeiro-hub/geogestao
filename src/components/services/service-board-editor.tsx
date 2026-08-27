"use client";

import { useState, useTransition } from "react";
import { GripVertical, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createServiceColumnAction, createServiceTypeAction, deactivateServiceColumnAction, deactivateServiceTypeAction, reorderServiceBoardsAction, reorderServiceColumnsAction } from "@/app/(app)/servicos/editor-actions";
import type { ServiceBoard, ServiceColumn } from "@/types/database";

export function ServiceBoardEditor({
  boards,
  columns,
  selectedBoardId,
  canEdit,
}: {
  boards: ServiceBoard[];
  columns: ServiceColumn[];
  selectedBoardId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState("");
  const [newStage, setNewStage] = useState("");
  const [pending, startTransition] = useTransition();
  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const selectedColumns = columns.filter((column) => column.board_id === selectedBoardId && column.is_active !== false).sort((a, b) => a.position - b.position);

  if (!canEdit) return null;

  function run(action: () => Promise<unknown>) {
    startTransition(() => { void action().catch((error) => window.alert(error instanceof Error ? error.message : "Não foi possível salvar.")); });
  }

  function addType() {
    if (!newType.trim()) return;
    run(async () => { await createServiceTypeAction(newType); setNewType(""); });
  }

  function addStage(position?: number) {
    if (!newStage.trim()) return;
    run(async () => { await createServiceColumnAction(selectedBoardId, newStage, position); setNewStage(""); });
  }

  function moveBoard(boardId: string, direction: -1 | 1) {
    const index = boards.findIndex((board) => board.id === boardId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= boards.length) return;
    const next = [...boards];
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderServiceBoardsAction(next.map((board) => board.id)));
  }

  function reorderBoardAt(boardId: string, targetBoardId: string) {
    if (boardId === targetBoardId) return;
    const next = [...boards];
    const from = next.findIndex((board) => board.id === boardId);
    const to = next.findIndex((board) => board.id === targetBoardId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    run(() => reorderServiceBoardsAction(next.map((board) => board.id)));
  }

  function reorderColumnAt(columnId: string, targetColumnId: string) {
    if (columnId === targetColumnId) return;
    const next = [...selectedColumns];
    const from = next.findIndex((column) => column.id === columnId);
    const to = next.findIndex((column) => column.id === targetColumnId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    run(() => reorderServiceColumnsAction(selectedBoardId, next.map((column) => column.id)));
  }

  return (
    <section className="rounded-lg border bg-card p-3" data-testid="service-flow-editor">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">Tipos e etapas</p><p className="text-xs text-muted-foreground">Personalize o fluxo operacional da organização.</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)}><Pencil className="size-4" aria-hidden="true" /> {open ? "Fechar edição" : "Editar"}</Button>
      </div>
      {open ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-sm font-semibold">Tipos de serviço</h3>
            <div className="mt-2 space-y-1">
              {boards.map((board, index) => (
                <div key={board.id} draggable onDragStart={() => setDraggingBoardId(board.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingBoardId) reorderBoardAt(draggingBoardId, board.id); setDraggingBoardId(null); }} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${board.id === selectedBoardId ? "border-primary bg-primary/5" : ""}`}>
                  <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm">{board.name}</span>
                  <button type="button" className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label={`Mover ${board.name} para cima`} disabled={pending || index === 0} onClick={() => moveBoard(board.id, -1)}>↑</button>
                  <button type="button" className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label={`Mover ${board.name} para baixo`} disabled={pending || index === boards.length - 1} onClick={() => moveBoard(board.id, 1)}>↓</button>
                  <button type="button" className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label={`Desativar ${board.name}`} onClick={() => { if (window.confirm(`Desativar ${board.name} apenas nesta organização?`)) run(() => deactivateServiceTypeAction(board.id)); }}><X className="size-4" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="Novo tipo de serviço" value={newType} onChange={(event) => setNewType(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addType(); }} /><Button type="button" size="sm" onClick={addType} disabled={pending || !newType.trim()}><Plus className="size-4" aria-hidden="true" /> Adicionar</Button></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Etapas do tipo selecionado</h3>
            <div className="mt-2 space-y-1">
              {selectedColumns.map((column, index) => (
                <div key={column.id} draggable onDragStart={() => setDraggingColumnId(column.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingColumnId) reorderColumnAt(draggingColumnId, column.id); setDraggingColumnId(null); }}>
                  <div className="flex items-center gap-2 rounded-md border px-2 py-1.5"><GripVertical className="size-4 text-muted-foreground" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm">{column.name}</span><button type="button" className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label={`Desativar etapa ${column.name}`} onClick={() => { if (window.confirm(`Desativar a etapa ${column.name}?`)) run(() => deactivateServiceColumnAction(column.id, selectedColumns[index + 1]?.id ?? selectedColumns[index - 1]?.id)); }}><X className="size-4" aria-hidden="true" /></button></div>
                  <button type="button" className="mx-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary" aria-label={`Adicionar etapa antes de ${column.name}`} onClick={() => addStage(index + 1)}><Plus className="size-3" aria-hidden="true" /> adicionar etapa aqui</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="Nova etapa" value={newStage} onChange={(event) => setNewStage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addStage(); }} /><Button type="button" size="sm" onClick={() => addStage()} disabled={pending || !newStage.trim()}><Plus className="size-4" aria-hidden="true" /> Adicionar</Button></div>
            <p className="mt-2 text-xs text-muted-foreground">Os serviços existentes não são apagados; uma etapa com cards exige destino antes de ser desativada.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
