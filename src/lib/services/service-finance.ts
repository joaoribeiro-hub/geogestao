import type { Json, PaymentStatus, ServiceCard, ServiceColumn } from "@/types/database";

export type ServiceFinanceCard = Pick<
  ServiceCard,
  "custom_fields_json" | "payment_status" | "column_id"
>;

export type ServiceFinanceSummary = {
  estimatedProfit: number;
  realizedProfit: number;
  lostProfit: number;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function parseBrlCurrencyInput(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const negative = cleaned.startsWith("-");
  const unsigned = cleaned.replace(/-/g, "");
  const commaIndex = unsigned.lastIndexOf(",");
  const dotIndex = unsigned.lastIndexOf(".");

  let normalized = unsigned;
  if (commaIndex >= 0) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else if (dotIndex >= 0) {
    const dotGroups = unsigned.split(".");
    const dotLooksLikeThousands =
      dotGroups.length > 1 &&
      dotGroups.slice(1).every((group) => group.length === 3);
    normalized = dotLooksLikeThousands ? unsigned.replace(/\./g, "") : unsigned;
  }

  const parsed = Number(`${negative ? "-" : ""}${normalized}`);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Number(parsed.toFixed(2));
}

export function formatBrlCurrency(value: number | null | undefined) {
  return moneyFormatter.format(Number(value ?? 0));
}

export function getServiceEstimatedValue(card: Pick<ServiceCard, "custom_fields_json">) {
  const metadata = asRecord(card.custom_fields_json);
  const candidates = [
    metadata.valor_previsto,
    metadata.valor_proposta,
    metadata.estimated_value,
    metadata.amount,
  ];

  for (const candidate of candidates) {
    const value = numericJson(candidate);
    if (value !== null) return value;
  }

  const cents = numericJson(metadata.valor_previsto_centavos);
  if (cents !== null) return Number((cents / 100).toFixed(2));

  return 0;
}

export function isServiceLostColumn(column: Pick<ServiceColumn, "slug" | "name"> | null | undefined) {
  const key = `${column?.slug ?? ""} ${column?.name ?? ""}`.toLowerCase();
  return key.includes("servico-perdido") || key.includes("servico perdido");
}

export function isPaidService(paymentStatus: PaymentStatus | null | undefined) {
  return paymentStatus === "pagamento_efetuado";
}

export function calculateServiceFinanceSummary(
  cards: ServiceFinanceCard[],
  columnsById: Map<string, Pick<ServiceColumn, "slug" | "name">>,
): ServiceFinanceSummary {
  return cards.reduce<ServiceFinanceSummary>(
    (summary, card) => {
      const value = getServiceEstimatedValue(card as Pick<ServiceCard, "custom_fields_json">);
      if (value <= 0) return summary;

      const isLost = isServiceLostColumn(columnsById.get(card.column_id));
      if (isLost) {
        summary.lostProfit += value;
        return summary;
      }

      summary.estimatedProfit += value;
      if (isPaidService(card.payment_status)) {
        summary.realizedProfit += value;
      }

      return summary;
    },
    { estimatedProfit: 0, realizedProfit: 0, lostProfit: 0 },
  );
}

function asRecord(value: Json): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}

function numericJson(value: Json | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toFixed(2));
  if (typeof value === "string" && value.trim()) return parseBrlCurrencyInput(value);
  return null;
}
