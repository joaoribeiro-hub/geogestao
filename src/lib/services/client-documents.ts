export const clientDocumentNameOptions = [
  "Documentos pessoais",
  "RG",
  "CPF",
  "CNH",
  "Comprovante de endereco",
  "Matricula",
  "Certidao de inteiro teor",
  "Escritura",
  "Contrato de compra e venda",
  "CCIR",
  "ITR",
  "CAR",
  "Recibo do CAR",
  "Demonstrativo do CAR",
  "Procuracao",
  "ART",
  "Planta",
  "Memorial descritivo",
  "Certidao negativa",
  "Comprovante de pagamento",
  "Outros",
] as const;

export type ClientDocumentNameOption = (typeof clientDocumentNameOptions)[number];

export function resolveClientDocumentName({
  selectedName,
  customName,
}: {
  selectedName: string | null | undefined;
  customName?: string | null;
}) {
  const selected = selectedName?.trim();
  const custom = customName?.trim();

  if (selected === "Outros") return custom || "Outros";
  return selected || "Documento";
}

export function splitClientDocumentName(value: string | null | undefined) {
  const name = value?.trim();
  if (!name) return { selectedName: "Documentos pessoais", customName: "" };

  if (clientDocumentNameOptions.includes(name as ClientDocumentNameOption)) {
    return { selectedName: name, customName: "" };
  }

  return { selectedName: "Outros", customName: name };
}
