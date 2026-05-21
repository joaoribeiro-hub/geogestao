import type {
  PaymentStatus,
  Priority,
  ProposalServiceType,
  ServiceCard,
  ServiceColumn,
} from "@/types/database";

export const serviceTypeLabels: Record<ProposalServiceType, string> = {
  georreferenciamento: "Georreferenciamento",
  car: "CAR",
  itr_ccir: "ITR/CCIR",
  outros_servicos: "Outros Servicos",
};

export const priorityLabels: Record<Priority, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pagamento_nao_efetuado: "Pagamento nao efetuado",
  pagamento_efetuado: "Pagamento efetuado",
};

export const serviceFlowSlugs = {
  awaitingDocuments: "aguardando-documentos",
  proposalContract: "proposta-contrato",
  inProgress: "geo-em-andamento",
  priority: "prioridade",
  overdue: "em-atraso",
  finished: "geo-concluido",
  lost: "servico-perdido",
} as const;

export const serviceWorkflowDefinitions: Record<
  ProposalServiceType,
  Array<{ name: string; slug: string; position: number }>
> = {
  georreferenciamento: [
    { name: "Aguardando documentos", slug: serviceFlowSlugs.awaitingDocuments, position: 1 },
    { name: "Proposta/Contrato", slug: serviceFlowSlugs.proposalContract, position: 2 },
    { name: "Geo em Andamento", slug: "geo-em-andamento", position: 3 },
    { name: "Prioridade", slug: serviceFlowSlugs.priority, position: 4 },
    { name: "Em atraso", slug: serviceFlowSlugs.overdue, position: 5 },
    { name: "Geo Protocolado no Cartorio", slug: "geo-protocolado-cartorio", position: 6 },
    { name: "Geo Protocolado no INCRA", slug: "geo-protocolado-incra", position: 7 },
    { name: "Geo - Pendencia de Confrontante", slug: "geo-pendencia-confrontante", position: 8 },
    { name: "Geo Concluido", slug: "geo-concluido", position: 9 },
    { name: "Servico perdido", slug: serviceFlowSlugs.lost, position: 10 },
  ],
  car: [
    { name: "Aguardando documentos", slug: serviceFlowSlugs.awaitingDocuments, position: 1 },
    { name: "Proposta/Contrato", slug: serviceFlowSlugs.proposalContract, position: 2 },
    { name: "CAR em Andamento", slug: "car-em-andamento", position: 3 },
    { name: "Prioridade", slug: serviceFlowSlugs.priority, position: 4 },
    { name: "Em atraso", slug: serviceFlowSlugs.overdue, position: 5 },
    { name: "CAR Protocolado/Em Analise", slug: "car-protocolado-em-analise", position: 6 },
    { name: "CAR Concluido", slug: "car-concluido", position: 7 },
    { name: "Servico perdido", slug: serviceFlowSlugs.lost, position: 8 },
  ],
  itr_ccir: [
    { name: "Aguardando documentos", slug: serviceFlowSlugs.awaitingDocuments, position: 1 },
    { name: "Proposta/Contrato", slug: serviceFlowSlugs.proposalContract, position: 2 },
    { name: "ITR/CCIR em Andamento", slug: "itr-ccir-em-andamento", position: 3 },
    { name: "Prioridade", slug: serviceFlowSlugs.priority, position: 4 },
    { name: "Em atraso", slug: serviceFlowSlugs.overdue, position: 5 },
    { name: "Protocolado/Enviado", slug: "protocolado-enviado", position: 6 },
    { name: "Concluido", slug: "concluido", position: 7 },
    { name: "Servico perdido", slug: serviceFlowSlugs.lost, position: 8 },
  ],
  outros_servicos: [
    { name: "Aguardando documentos", slug: serviceFlowSlugs.awaitingDocuments, position: 1 },
    { name: "Proposta/Contrato", slug: serviceFlowSlugs.proposalContract, position: 2 },
    { name: "Em Andamento", slug: "em-andamento", position: 3 },
    { name: "Prioridade", slug: serviceFlowSlugs.priority, position: 4 },
    { name: "Em atraso", slug: serviceFlowSlugs.overdue, position: 5 },
    { name: "Concluido", slug: "concluido", position: 6 },
    { name: "Servico perdido", slug: serviceFlowSlugs.lost, position: 7 },
  ],
};

export const serviceDefaultChecklists: Record<ProposalServiceType, string[]> = {
  georreferenciamento: [
    "Documentos pessoais",
    "Matricula",
    "CCIR",
    "ITR",
    "CAR",
    "Procuracao, se necessario",
    "ART",
    "Levantamento de campo",
    "Processamento",
    "Memorial descritivo",
    "Planta",
    "Envio/registro",
  ],
  car: [
    "Documentos do proprietario",
    "Matricula",
    "Area do imovel",
    "Consulta CAR",
    "Analise ambiental",
    "Retificacao/cadastro",
    "Recibo/demonstrativo",
    "Entrega",
  ],
  itr_ccir: [
    "Dados do imovel",
    "Dados do proprietario",
    "CCIR",
    "ITR anterior",
    "CAFIR/CIB, se aplicavel",
    "Declaracao",
    "Protocolo",
    "Entrega",
  ],
  outros_servicos: [
    "Briefing",
    "Levantamento",
    "Estudo preliminar",
    "Anteprojeto",
    "Projeto executivo",
    "Aprovacao",
    "Entrega final",
  ],
};

export function sortServiceColumns(columns: ServiceColumn[]) {
  return [...columns].sort((a, b) => a.position - b.position);
}

export function getInitialServiceColumn(columns: ServiceColumn[]) {
  const sorted = sortServiceColumns(columns);
  return (
    sorted.find((column) => column.slug === serviceFlowSlugs.awaitingDocuments) ??
    sorted[0] ??
    null
  );
}

export function getProposalContractColumn(columns: ServiceColumn[]) {
  return sortServiceColumns(columns).find(
    (column) => column.slug === serviceFlowSlugs.proposalContract,
  );
}

export function getExecutionColumn(columns: ServiceColumn[], priority: Priority) {
  const sorted = sortServiceColumns(columns);
  const priorityColumn = sorted.find((column) => column.slug === serviceFlowSlugs.priority);
  if ((priority === "high" || priority === "urgent") && priorityColumn) {
    return priorityColumn;
  }

  return (
    sorted.find((column) => /andamento/i.test(`${column.slug} ${column.name}`)) ??
    priorityColumn ??
    getNextColumn(columns, getProposalContractColumn(columns)?.id ?? "") ??
    sorted[0] ??
    null
  );
}

export function getServiceColumns(
  serviceType: ProposalServiceType,
  columns: ServiceColumn[],
) {
  const desired = serviceWorkflowDefinitions[serviceType];
  const desiredSlugs = new Set(desired.map((column) => column.slug));
  const matching = columns.filter((column) => desiredSlugs.has(column.slug));

  if (matching.length) {
    return sortServiceColumns(matching);
  }

  return sortServiceColumns(columns);
}

export function getNextColumn(columns: ServiceColumn[], currentColumnId: string) {
  const sorted = sortServiceColumns(columns);
  const index = sorted.findIndex((column) => column.id === currentColumnId);
  if (index < 0) return null;
  return sorted[index + 1] ?? sorted[index] ?? null;
}

export function getDefaultChecklistItems(serviceType: ProposalServiceType | null | undefined) {
  return serviceDefaultChecklists[serviceType ?? "outros_servicos"];
}

export function getServiceCardTone({
  columnSlug,
  priority,
  dueDate,
}: {
  columnSlug?: string | null;
  priority: Priority;
  dueDate?: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  if (columnSlug === serviceFlowSlugs.lost) return "danger";
  if (columnSlug?.includes("conclu")) return "success";
  if (dueDate && dueDate < today) return "danger";
  if (priority === "high" || priority === "urgent") return "warning";
  if (columnSlug?.includes("aguardando") || columnSlug?.includes("pendencia")) {
    return "warning";
  }
  if (columnSlug?.includes("andamento") || columnSlug?.includes("protocolo")) {
    return "info";
  }
  return "neutral";
}

export function isLostServiceColumnSlug(columnSlug: string | null | undefined) {
  return columnSlug === serviceFlowSlugs.lost;
}

export function buildServiceSummary({
  card,
  columnName,
  hasClient,
  attachmentCount = 0,
}: {
  card: Pick<
    ServiceCard,
    "priority" | "due_date" | "payment_status" | "checklist_percent"
  >;
  columnName: string;
  hasClient: boolean;
  attachmentCount?: number;
}) {
  const pieces: string[] = [];
  const percent = Number(card.checklist_percent ?? 0);
  const today = new Date().toISOString().slice(0, 10);

  if (!hasClient) {
    pieces.push("Servico sem cliente vinculado. Proximo passo: cadastrar ou vincular cliente.");
  } else if (/aguardando/i.test(columnName)) {
    pieces.push("Este servico esta aguardando documentos do cliente.");
  } else if (/proposta|contrato/i.test(columnName)) {
    pieces.push("Documentacao recebida. Proximo passo: preparar proposta e contrato.");
  } else if (/perdido/i.test(columnName)) {
    pieces.push("Servico marcado como perdido. O valor entra como lucro perdido.");
  } else if (/conclu/i.test(columnName)) {
    pieces.push("Servico concluido. Confira anexos finais e financeiro.");
  } else {
    pieces.push("Servico em execucao. Acompanhe etapa, prazo e pendencias.");
  }

  if (card.priority === "high" || card.priority === "urgent") {
    pieces.push("Prioridade alta: revise pendencias antes de seguir.");
  }

  if (card.due_date) {
    pieces.push(
      card.due_date < today
        ? "Prazo vencido."
        : `Prazo previsto: ${card.due_date}.`,
    );
  }

  if (card.payment_status === "pagamento_nao_efetuado") {
    pieces.push("Pagamento ainda nao efetuado.");
  }

  if (percent > 0) {
    pieces.push(`Checklist em ${percent.toFixed(0)}%.`);
  }

  if (attachmentCount === 0) {
    pieces.push("Nenhum anexo registrado no servico.");
  }

  return pieces.join(" ");
}
