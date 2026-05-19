import { describe, expect, it } from "vitest";
import {
  calculateServiceFinanceSummary,
  getServiceEstimatedValue,
  isServiceLostColumn,
  parseBrlCurrencyInput,
  type ServiceFinanceCard,
} from "@/lib/services/service-finance";
import type { ServiceCard, ServiceColumn } from "@/types/database";

describe("service-finance", () => {
  it("interpreta formato monetario brasileiro sem transformar 16.000 em 16", () => {
    expect(parseBrlCurrencyInput("16.000")).toBe(16000);
    expect(parseBrlCurrencyInput("R$ 16.000,00")).toBe(16000);
    expect(parseBrlCurrencyInput("1.500,50")).toBe(1500.5);
    expect(parseBrlCurrencyInput("250,00")).toBe(250);
  });

  it("extrai valor previsto dos metadados do servico", () => {
    expect(
      getServiceEstimatedValue({
        custom_fields_json: { valor_previsto: 16000 },
      }),
    ).toBe(16000);
  });

  it("calcula lucro estimado, efetuado e perdido por coluna e pagamento", () => {
    const columns = new Map<string, Pick<ServiceColumn, "slug" | "name">>([
      ["active", { slug: "aguardando-documentos", name: "Aguardando documentos" }],
      ["lost", { slug: "servico-perdido", name: "Servico perdido" }],
    ]);
    const summary = calculateServiceFinanceSummary(
      [
        card("active", 16000, "pagamento_nao_efetuado"),
        card("active", 2500, "pagamento_efetuado"),
        card("lost", 9000, "pagamento_efetuado"),
      ],
      columns,
    );

    expect(summary.estimatedProfit).toBe(18500);
    expect(summary.realizedProfit).toBe(2500);
    expect(summary.lostProfit).toBe(9000);
    expect(isServiceLostColumn(columns.get("lost"))).toBe(true);
  });
});

function card(columnId: string, value: number, paymentStatus: ServiceCard["payment_status"]) {
  return {
    column_id: columnId,
    payment_status: paymentStatus,
    custom_fields_json: { valor_previsto: value },
  } as ServiceFinanceCard;
}
