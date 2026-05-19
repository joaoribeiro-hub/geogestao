"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
} from "lucide-react";
import {
  advanceServiceCardAction,
  completeServiceDocumentationAction,
  createContractForServiceAction,
  createProposalForServiceAction,
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
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(cards);
  }, [cards]);

  const grouped = useMemo(() => {
    return columns.reduce<Record<string, ServiceCardWithClient[]>>((acc, column) => {
      acc[column.id] = items
        .filter((card) => card.column_id === column.id)
        .sort((a, b) => a.position - b.position);
      return acc;
    }, {});
  }, [columns, items]);

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

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div
        className="flex gap-4 overflow-x-auto pb-4"
        data-testid="service-kanban"
      >
        {columns.map((column) => (
          <ServiceColumnView key={column.id} column={column}>
            {grouped[column.id]?.map((card) => (
              <ServiceCardView
                key={card.id}
                card={card}
                column={column}
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
}: {
  column: ServiceColumn;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      data-testid="service-column"
      data-service-column-name={column.name}
      className={`min-h-[32rem] w-[320px] shrink-0 rounded-md border bg-secondary/55 p-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{column.name}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {Array.isArray(children) ? children.length : ""}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ServiceCardView({
  card,
  column,
}: {
  card: ServiceCardWithClient;
  column: ServiceColumn;
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
  const isFinished =
    column.slug === serviceFlowSlugs.finished ||
    column.slug === serviceFlowSlugs.lost ||
    /conclu/i.test(column.slug);

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

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-testid="service-card"
      data-service-card-title={card.title}
      className={`group cursor-pointer rounded-md border bg-background p-3 shadow-sm transition hover:border-primary/50 ${
        isDragging ? "opacity-70 shadow-soft" : ""
      }`}
      onClick={() => router.push(`/servicos/${card.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") router.push(`/servicos/${card.id}`);
      }}
    >
      <div className={`mb-3 h-1.5 rounded-full ${toneClasses}`} />
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
          <p className="truncate text-sm font-semibold">
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
          <>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() =>
                runAction(
                  () => createProposalForServiceAction(card.id),
                  "Proposta vinculada ao servico.",
                )
              }
            >
              Nova Proposta
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() =>
                runAction(
                  () => createContractForServiceAction(card.id),
                  "Contrato vinculado ao servico.",
                )
              }
            >
              Novo Contrato
            </Button>
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
          </>
        ) : null}

        {!isAwaitingDocs && !isProposalContract ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={card.proposal_id ? `/propostas/${card.proposal_id}` : `/servicos/${card.id}#proposta`}>
                  Proposta
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={card.contract_id ? `/contratos/${card.contract_id}` : `/servicos/${card.id}#contrato`}>
                  Contrato
                </a>
              </Button>
            </div>
            {!isFinished ? (
              <Button
                size="sm"
                className="w-full"
                disabled={pending}
                onClick={() =>
                  runAction(
                    () => advanceServiceCardAction(card.id),
                    "Servico avancou para a proxima etapa.",
                  )
                }
              >
                Proximo
              </Button>
            ) : null}
          </>
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
