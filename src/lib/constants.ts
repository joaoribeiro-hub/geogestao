import { ptBR } from "@/lib/i18n/pt-br";

export const proposalStages = [
  { id: "todo", title: ptBR.proposalStages.todo },
  { id: "sent", title: ptBR.proposalStages.sent },
  { id: "negotiation", title: ptBR.proposalStages.negotiation },
  { id: "execution", title: ptBR.proposalStages.execution },
  { id: "finished", title: ptBR.proposalStages.finished },
  { id: "lost", title: ptBR.proposalStages.lost },
] as const;

export const serviceBoardSlugs = [
  "georreferenciamento",
  "car",
  "itr-ccir",
  "outros-servicos",
] as const;

export const proposalServiceTypes = [
  { id: "georreferenciamento", label: "Georreferenciamento" },
  { id: "car", label: "CAR" },
  { id: "itr_ccir", label: "ITR/CCIR" },
  { id: "outros_servicos", label: "Outros Servicos" },
] as const;

export const paymentStatuses = [
  { id: "pagamento_nao_efetuado", label: "Pagamento nao efetuado" },
  { id: "pagamento_efetuado", label: "Pagamento efetuado" },
] as const;

export const entityTypes = [
  "client",
  "proposal",
  "service_card",
  "contract",
  "revenue",
  "expense",
  "document_template",
  "legislation_item",
] as const;
