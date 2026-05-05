"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { ArrowRightCircle, GripVertical } from "lucide-react";
import {
  convertProposalAction,
  markProposalPaymentAsPaid,
  moveProposalAction,
  revertProposalFromService,
} from "@/app/(app)/propostas/actions";
import { proposalServiceTypes, proposalStages } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Client, Proposal, ProposalStage } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProposalWithClient = Proposal & { client?: Pick<Client, "id" | "name"> | null };

const serviceTypeLabels = new Map(
  proposalServiceTypes.map((serviceType) => [serviceType.id, serviceType.label]),
);

const paymentStatusLabels = {
  pagamento_nao_efetuado: "Pagamento nao efetuado",
  pagamento_efetuado: "Pagamento efetuado",
} as const;

export function ProposalKanban({
  proposals,
}: {
  proposals: ProposalWithClient[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(proposals);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(proposals);
  }, [proposals]);

  const grouped = useMemo(() => {
    return proposalStages.reduce<Record<ProposalStage, ProposalWithClient[]>>(
      (acc, stage) => {
        acc[stage.id] = items
          .filter((proposal) => proposal.stage === stage.id)
          .sort((a, b) => a.position - b.position);
        return acc;
      },
      {
        todo: [],
        sent: [],
        negotiation: [],
        execution: [],
        finished: [],
        lost: [],
      },
    );
  }, [items]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const proposalId = String(active.id);
    const targetStage = proposalStages.find((stage) => stage.id === over.id)?.id;
    if (!targetStage) return;

    const current = items.find((proposal) => proposal.id === proposalId);
    if (!current || current.stage === targetStage) return;

    setFeedback(null);
    setItems((previous) =>
      previous.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, stage: targetStage } : proposal,
      ),
    );

    startTransition(() => {
      void (async () => {
        try {
          const result = await moveProposalAction(
            proposalId,
            targetStage,
            grouped[targetStage].length + 1,
          );
          if (targetStage === "execution") {
            setFeedback({
              type: "success",
              message:
                result?.message ??
                "Proposta em execucao. Contrato, servico e receita foram vinculados.",
            });
          }
          router.refresh();
        } catch (error) {
          setItems((previous) =>
            previous.map((proposal) =>
              proposal.id === proposalId ? { ...proposal, stage: current.stage } : proposal,
            ),
          );
          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Nao foi possivel mover a proposta.",
          });
        }
      })();
    });
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      {feedback ? (
        <p
          className={`mb-3 rounded-md p-3 text-sm ${
            feedback.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
      <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-6">
        {proposalStages.map((stage) => (
          <ProposalColumn key={stage.id} id={stage.id} title={stage.title}>
            {grouped[stage.id].map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </ProposalColumn>
        ))}
      </div>
    </DndContext>
  );
}

function ProposalColumn({
  id,
  title,
  children,
}: {
  id: ProposalStage;
  title: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={`min-h-80 rounded-lg border bg-card p-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ProposalCard({ proposal }: { proposal: ProposalWithClient }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: proposal.id,
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
        <span className="line-clamp-2">{proposal.title}</span>
      </button>
      <p className="text-xs text-muted-foreground">{proposal.client?.name ?? "Sem cliente"}</p>
      {proposal.description ? (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
          {proposal.description}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">
          {serviceTypeLabels.get(proposal.service_type) ?? "Outros Servicos"}
        </Badge>
        <Badge
          variant={
            proposal.payment_status === "pagamento_efetuado" ? "secondary" : "outline"
          }
        >
          {paymentStatusLabels[proposal.payment_status ?? "pagamento_nao_efetuado"]}
        </Badge>
        <Badge variant="secondary">{formatCurrency(proposal.value)}</Badge>
        {proposal.valid_until ? (
          <Badge variant="outline">Validade {formatDate(proposal.valid_until)}</Badge>
        ) : null}
      </div>
      {proposal.converted_service_card_id || proposal.service_card_id ? (
        <div className="mt-3 grid gap-2">
          <Badge variant="outline">Convertida</Badge>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending || proposal.payment_status === "pagamento_efetuado"}
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  setFeedback(null);
                  try {
                    const result = await markProposalPaymentAsPaid(proposal.id);
                    setFeedback({ type: "success", message: result.message });
                    router.refresh();
                  } catch (error) {
                    setFeedback({
                      type: "error",
                      message:
                        error instanceof Error
                          ? error.message
                          : "Nao foi possivel registrar o pagamento.",
                    });
                  }
                })();
              })
            }
          >
            {pending ? "Processando..." : "Pagamento efetuado"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  setFeedback(null);
                  try {
                    const result = await revertProposalFromService(proposal.id);
                    setFeedback({ type: "success", message: result.message });
                    router.refresh();
                  } catch (error) {
                    setFeedback({
                      type: "error",
                      message:
                        error instanceof Error
                          ? error.message
                          : "Nao foi possivel voltar a proposta.",
                    });
                  }
                })();
              })
            }
          >
            Voltar
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void (async () => {
                setFeedback(null);
                try {
                  const result = await convertProposalAction(proposal.id);
                  setFeedback({
                    type: "success",
                    message: result.message,
                  });
                  router.refresh();
                } catch (error) {
                  setFeedback({
                    type: "error",
                    message:
                      error instanceof Error
                        ? error.message
                        : "Nao foi possivel converter a proposta.",
                  });
                }
              })();
            })
          }
        >
          <ArrowRightCircle aria-hidden="true" />
          {pending ? "Convertendo..." : "Converter em servico"}
        </Button>
      )}
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
    </article>
  );
}
