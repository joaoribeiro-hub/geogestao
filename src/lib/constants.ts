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

export const entityTypes = [
  "client",
  "proposal",
  "service_card",
  "revenue",
  "expense",
  "document_template",
  "legislation_item",
] as const;
