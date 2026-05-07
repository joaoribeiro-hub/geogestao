import { describe, expect, it } from "vitest";
import {
  clientSchema,
  financeSchema,
  proposalSchema,
  propertyMapSchema,
} from "@/lib/schemas";

describe("schemas", () => {
  it("normaliza campos opcionais do cliente para null", () => {
    const parsed = clientSchema.parse({
      kind: "pj",
      name: "  Cliente Teste Ltda  ",
      document: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    });

    expect(parsed).toMatchObject({
      kind: "pj",
      name: "Cliente Teste Ltda",
      document: null,
      email: null,
      phone: null,
      address: null,
      notes: null,
    });
  });

  it("exige tipo de servico valido em proposta", () => {
    const result = proposalSchema.safeParse({
      client_id: "11111111-1111-4111-8111-111111111111",
      title: "Proposta CAR",
      description: "",
      service_type: "car",
      value: "1500.50",
      sent_at: "",
      valid_until: "2026-06-30",
      comments: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe(1500.5);
      expect(result.data.sent_at).toBeNull();
      expect(result.data.service_type).toBe("car");
    }
  });

  it("rejeita receita sem valor positivo", () => {
    const result = financeSchema.safeParse({
      client_id: "11111111-1111-4111-8111-111111111111",
      proposal_id: "",
      service_card_id: "",
      description: "Receita teste",
      category: "Teste",
      amount: "0",
      due_date: "2026-05-10",
      paid_at: "",
      status: "pending",
    });

    expect(result.success).toBe(false);
  });

  it("valida payload minimo do mapa com GeoJSON serializado", () => {
    const parsed = propertyMapSchema.parse({
      client_id: "11111111-1111-4111-8111-111111111111",
      service_card_id: "",
      name: "Fazenda Teste",
      area: "12.5",
      registry_number: "",
      registry_date: "",
      car_state: "",
      car_federal: "",
      city: "Londrina",
      state: "PR",
      notes: "",
      file_path: "mapa/client/teste.kml",
      file_name: "teste.kml",
      mime_type: "",
      size_bytes: "123",
      geojson: '{"type":"FeatureCollection","features":[]}',
    });

    expect(parsed.service_card_id).toBeNull();
    expect(parsed.area).toBe(12.5);
    expect(parsed.registry_date).toBeNull();
  });
});
