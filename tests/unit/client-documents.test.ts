import { describe, expect, it } from "vitest";
import {
  clientDocumentNameOptions,
  resolveClientDocumentName,
  splitClientDocumentName,
} from "@/lib/services/client-documents";

describe("client documents", () => {
  it("oferece nomes padrao para documentos rurais e imobiliarios", () => {
    expect(clientDocumentNameOptions).toContain("Matricula");
    expect(clientDocumentNameOptions).toContain("CCIR");
    expect(clientDocumentNameOptions).toContain("Demonstrativo do CAR");
    expect(clientDocumentNameOptions).toContain("Outros");
  });

  it("salva nome personalizado quando usuario escolhe Outros", () => {
    expect(
      resolveClientDocumentName({
        selectedName: "Outros",
        customName: "Certidao municipal",
      }),
    ).toBe("Certidao municipal");
  });

  it("separa nome salvo entre opcao padrao e personalizada", () => {
    expect(splitClientDocumentName("CPF")).toEqual({
      selectedName: "CPF",
      customName: "",
    });
    expect(splitClientDocumentName("Contrato de arrendamento")).toEqual({
      selectedName: "Outros",
      customName: "Contrato de arrendamento",
    });
  });
});
