import type {
  Database,
  PaymentStatus,
  Proposal,
  ProposalServiceType,
} from "@/types/database";

export type ProposalForServiceRules = Pick<
  Proposal,
  | "id"
  | "title"
  | "description"
  | "comments"
  | "service_type"
  | "converted_at"
  | "payment_status"
>;

export function normalizeProposalServiceType(
  proposal: ProposalForServiceRules,
): ProposalServiceType {
  if (
    proposal.service_type === "georreferenciamento" ||
    proposal.service_type === "car" ||
    proposal.service_type === "itr_ccir" ||
    proposal.service_type === "outros_servicos"
  ) {
    return proposal.service_type;
  }

  const legacyType = String(proposal.service_type);
  if (legacyType === "itr-ccir") return "itr_ccir";
  if (legacyType === "outros-servicos") return "outros_servicos";

  const text = [proposal.title, proposal.description, proposal.comments]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bcar\b|cadastro ambiental/.test(text)) return "car";
  if (/\bitr\b|ccir/.test(text)) return "itr_ccir";
  if (/geo|georreferenciamento|sigef|incra/.test(text)) return "georreferenciamento";

  return "outros_servicos";
}

export function buildProposalExecutionUpdate({
  proposal,
  contractId,
  serviceCardId,
  convertedAt,
}: {
  proposal: ProposalForServiceRules;
  contractId: string;
  serviceCardId: string;
  convertedAt: string;
}): Database["public"]["Tables"]["proposals"]["Update"] {
  return {
    stage: "execution",
    contract_id: contractId,
    service_card_id: serviceCardId,
    converted_service_card_id: serviceCardId,
    converted_at: proposal.converted_at ?? convertedAt,
    payment_status: proposal.payment_status ?? "pagamento_nao_efetuado",
  };
}

export function buildProposalRevertUpdate(): Database["public"]["Tables"]["proposals"]["Update"] {
  return {
    stage: "sent",
    service_card_id: null,
    converted_service_card_id: null,
    converted_at: null,
    payment_status: "pagamento_nao_efetuado",
  };
}

export function buildPaymentStatusUpdate(
  paymentStatus: PaymentStatus,
): Pick<Database["public"]["Tables"]["proposals"]["Update"], "payment_status"> {
  return { payment_status: paymentStatus };
}
