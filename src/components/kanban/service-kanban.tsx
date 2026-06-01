"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GripVertical,
  Paperclip,
  RotateCcw,
  X,
} from "lucide-react";
import {
  completeServiceDocumentationAction,
  deleteServiceCardAction,
  moveServiceCardAction,
  moveServiceToExecutionAction,
  revertServiceToProposal,
} from "@/app/(app)/servicos/actions";
import {
  getServiceCardTone,
  paymentStatusLabels,
  priorityLabels,
  serviceFlowSlugs,
} from "@/lib/services/service-flow";
import { formatDate } from "@/lib/utils";
import type { Client, ServiceCard, ServiceColumn } from "@/types/database";
import { Button } from "@/components/ui/button";

type ServiceCardWithClient = ServiceCard & {
  client?: Pick<Client, "id" | "name"> | null;
};

export function ServiceKanban({
  columns,
  cards,
}: {
  columns: ServiceColumn[];
  cards: ServiceCardWithClient[];
}) {
  const [items, setItems] = useState(cards);
  const [zoom, setZoom] = useState<"compacto" | "normal" | "ampliado">("compacto");
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});
  const [kanbanScrollWidth, setKanbanScrollWidth] = useState(0);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(cards);
  }, [cards]);

  function updateZoom(next: "compacto" | "normal" | "ampliado") {
    setZoom(next);
  }

  useEffect(() => {
    function updateScrollWidth() {
      setKanbanScrollWidth(bottomScrollRef.current?.scrollWidth ?? 0);
    }
    const frame = window.requestAnimationFrame(updateScrollWidth);
    window.addEventListener("resize", updateScrollWidth);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateScrollWidth);
    };
  }, [columns.length, items.length, zoom]);

  const grouped = useMemo(() => {
    return columns.reduce<Record<string, ServiceCardWithClient[]>>((acc, column) => {
      const search = (columnSearch[column.id] ?? "").trim().toLowerCase();
      acc[column.id] = items
        .filter((card) => card.column_id === column.id)
        .filter((card) => {
          if (!search) return true;
          return [card.client?.name, card.title, card.description, card.municipality]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(search));
        })
        .sort((a, b) => a.position - b.position);
      return acc;
    }, {});
  }, [columns, items, columnSearch]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const cardId = String(active.id);
    const toColumnId = String(over.id);
    const current = items.find((card) => card.id === cardId);
    if (!current || current.column_id === toColumnId) return;

    setItems((previous) =>
      previous.map((card) =>
        card.id === cardId ? { ...card, column_id: toColumnId } : card,
      ),
    );

    startTransition(() => {
      void moveServiceCardAction(cardId, toColumnId);
    });
  }

  function syncKanbanScroll(source: HTMLDivElement | null, target: HTMLDivElement | null) {
    if (!source || !target || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Zoom</span>
        {(["compacto", "normal", "ampliado"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={zoom === option ? "default" : "outline"}
            onClick={() => updateZoom(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <div
        ref={topScrollRef}
        className="mb-2 overflow-x-auto pb-2"
        data-testid="service-kanban-top-scroll"
        aria-label="Rolagem horizontal superior do Kanban"
        onScroll={() => syncKanbanScroll(topScrollRef.current, bottomScrollRef.current)}
      >
        <div style={{ width: kanbanScrollWidth, height: 1 }} aria-hidden="true" />
      </div>
      <div
        ref={bottomScrollRef}
        className="flex gap-4 overflow-x-auto pb-4"
        data-testid="service-kanban"
        onScroll={() => syncKanbanScroll(bottomScrollRef.current, topScrollRef.current)}
      >
        {columns.map((column) => (
          <ServiceColumnView
            key={column.id}
            column={column}
            search={columnSearch[column.id] ?? ""}
            onSearch={(value) => setColumnSearch((current) => ({ ...current, [column.id]: value }))}
            zoom={zoom}
          >
            {grouped[column.id]?.map((card) => (
              <ServiceCardView
                key={card.id}
                card={card}
                column={column}
                zoom={zoom}
              />
            ))}
          </ServiceColumnView>
        ))}
      </div>
    </DndContext>
  );
}

function ServiceColumnView({
  column,
  children,
  search,
  onSearch,
  zoom,
}: {
  column: ServiceColumn;
  children: React.ReactNode;
  search: string;
  onSearch: (value: string) => void;
  zoom: "compacto" | "normal" | "ampliado";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      data-testid="service-column"
      data-service-column-name={column.name}
      className={`min-h-[32rem] shrink-0 rounded-md border bg-secondary/55 p-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : ""
      } ${zoom === "compacto" ? "w-[260px]" : zoom === "ampliado" ? "w-[360px]" : "w-[320px]"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{column.name}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {Array.isArray(children) ? children.length : ""}
        </span>
      </div>
      <input
        className="mb-3 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
        placeholder="Buscar nesta coluna"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <div className="max-h-[46rem] space-y-3 overflow-y-auto pr-1" data-testid="service-column-scroll">
        {children}
      </div>
    </section>
  );
}

function ServiceCardView({
  card,
  column,
  zoom,
}: {
  card: ServiceCardWithClient;
  column: ServiceColumn;
  zoom: "compacto" | "normal" | "ampliado";
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const tone = getServiceCardTone({
    columnSlug: column.slug,
    priority: card.priority,
    dueDate: card.due_date,
  });
  const toneClasses = {
    success: "bg-emerald-600",
    warning: "bg-amber-500",
    danger: "bg-red-600",
    info: "bg-sky-600",
    neutral: "bg-slate-400",
  }[tone];
  const isAwaitingDocs = column.slug === serviceFlowSlugs.awaitingDocuments;
  const isProposalContract = column.slug === serviceFlowSlugs.proposalContract;

  function runAction(action: () => Promise<unknown>, success: string) {
    startTransition(() => {
      void (async () => {
        setFeedback(null);
        try {
          await action();
          setFeedback({ type: "success", message: success });
          router.refresh();
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error ? error.message : "Nao foi possivel executar a acao.",
          });
        }
      })();
    });
  }

  function deleteCard() {
    const confirmed = window.confirm(
      "Tem certeza que deseja apagar este servico?\n\nO servico sera apagado; propostas e contratos criados a partir dele serao apagados; o financeiro sera recalculado/atualizado. Cliente e documentos do cliente NAO serao apagados.",
    );
    if (!confirmed) return;

    startTransition(() => {
      void (async () => {
        setFeedback(null);
        try {
          await deleteServiceCardAction(card.id);
          setFeedback({ type: "success", message: "Servico apagado." });
          router.refresh();
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error ? error.message : "Nao foi possivel apagar o servico.",
          });
        }
      })();
    });
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-testid="service-card"
      data-service-card-title={card.title}
      className={`group cursor-pointer rounded-md border bg-background shadow-sm transition hover:border-primary/50 ${
        isDragging ? "opacity-70 shadow-soft" : ""
      } ${zoom === "compacto" ? "p-2 text-[13px]" : "p-3"}`}
      onClick={() => router.push(`/servicos/${card.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") router.push(`/servicos/${card.id}`);
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className={`h-1.5 flex-1 rounded-full ${toneClasses}`} />
        <button
          type="button"
          className="grid size-7 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition hover:opacity-90"
          aria-label="Apagar servico"
          title="Apagar servico"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            deleteCard();
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab rounded p-1 text-muted-foreground active:cursor-grabbing"
          type="button"
          aria-label="Arrastar servico"
          onClick={(event) => event.stopPropagation()}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {card.client?.name ?? "Sem cliente vinculado"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{card.title}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ClipboardCheck className="size-3.5" aria-hidden="true" />
          {Number(card.checklist_percent ?? 0).toFixed(0)}%
        </span>
        <span className="inline-flex items-center gap-1">
          <Paperclip className="size-3.5" aria-hidden="true" />
          Anexos
        </span>
        {card.due_date ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDate(card.due_date)}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {priorityLabels[card.priority]} · {paymentStatusLabels[card.payment_status]}
      </p>

      <div
        className="mt-3 grid gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        {!card.client_id ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="w-full"
          >
            <a href={`/servicos/${card.id}#cliente`}>Cadastrar cliente</a>
          </Button>
        ) : null}

        {isAwaitingDocs ? (
          <>
            <Button asChild size="sm" variant="outline" className="w-full">
              <a href={`/servicos/${card.id}#anexos`}>Anexar documentacao</a>
            </Button>
            <Button
              size="sm"
              className="w-full"
              disabled={pending}
              onClick={() =>
                runAction(
                  () => completeServiceDocumentationAction(card.id),
                  "Documentacao concluida.",
                )
              }
            >
              <CheckCircle2 aria-hidden="true" />
              Concluir documentacao
            </Button>
          </>
        ) : null}

        {isProposalContract ? (
          <Button
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              runAction(
                () => moveServiceToExecutionAction(card.id),
                "Servico movido para execucao.",
              )
            }
          >
            Em execucao
          </Button>
        ) : null}

        {card.proposal_id || card.created_from_proposal_id ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() =>
              runAction(() => revertServiceToProposal(card.id), "Servico voltou para proposta.")
            }
          >
            <RotateCcw aria-hidden="true" />
            Voltar servico
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <p
          className={`mt-2 flex items-start gap-2 rounded-md p-2 text-xs ${
            feedback.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {feedback.message}
        </p>
      ) : null}
    </article>
  );
}
