"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CalendarDays, GripVertical, RotateCcw } from "lucide-react";
import {
  moveServiceCardAction,
  revertServiceToProposal,
} from "@/app/(app)/servicos/actions";
import { formatDate } from "@/lib/utils";
import type { Client, Priority, ServiceCard, ServiceColumn } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ServiceCardWithClient = ServiceCard & {
  client?: Pick<Client, "id" | "name"> | null;
};

const priorityLabels: Record<Priority, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const paymentStatusLabels = {
  pagamento_nao_efetuado: "Pagamento nao efetuado",
  pagamento_efetuado: "Pagamento efetuado",
} as const;

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
      <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-4 2xl:grid-cols-5">
        {columns.map((column) => (
          <ServiceColumnView key={column.id} column={column}>
            {grouped[column.id]?.map((card) => <ServiceCardView key={card.id} card={card} />)}
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
      className={`min-h-80 rounded-lg border bg-card p-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : ""
      }`}
    >
      <h2 className="mb-3 text-sm font-semibold">{column.name}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ServiceCardView({ card }: { card: ServiceCardWithClient }) {
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

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-testid="service-card"
      data-service-card-title={card.title}
      className={`rounded-lg border bg-background p-3 shadow-sm ${
        isDragging ? "opacity-70 shadow-soft" : ""
      }`}
    >
      <button
        className="mb-2 flex w-full cursor-grab items-center gap-2 text-left text-sm font-semibold active:cursor-grabbing"
        type="button"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="line-clamp-2">{card.title}</span>
      </button>
      <p className="text-xs text-muted-foreground">{card.client?.name ?? "Sem cliente"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={card.priority === "urgent" ? "destructive" : "secondary"}>
          {priorityLabels[card.priority]}
        </Badge>
        {card.due_date ? (
          <Badge variant="outline">
            <CalendarDays aria-hidden="true" />
            {formatDate(card.due_date)}
          </Badge>
        ) : null}
        <Badge variant="outline">{Number(card.checklist_percent ?? 0).toFixed(0)}%</Badge>
        <Badge
          variant={
            card.payment_status === "pagamento_efetuado" ? "secondary" : "outline"
          }
        >
          {paymentStatusLabels[card.payment_status ?? "pagamento_nao_efetuado"]}
        </Badge>
      </div>
      {card.proposal_id || card.created_from_proposal_id ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          data-testid="service-revert-button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void (async () => {
                setFeedback(null);
                try {
                  const result = await revertServiceToProposal(card.id);
                  setFeedback({ type: "success", message: result.message });
                  router.refresh();
                } catch (error) {
                  setFeedback({
                    type: "error",
                    message:
                      error instanceof Error
                        ? error.message
                        : "Nao foi possivel voltar o servico.",
                  });
                }
              })();
            })
          }
        >
          <RotateCcw aria-hidden="true" />
          {pending ? "Voltando..." : "Voltar servico"}
        </Button>
      ) : null}
      {feedback ? (
        <p
          className={`mt-2 rounded-md p-2 text-xs ${
            feedback.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
      <Link
        href={`/servicos/${card.id}`}
        className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
      >
        Abrir detalhes
      </Link>
    </article>
  );
}
