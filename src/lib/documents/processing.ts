export type DocumentProcessingOutcome =
  | {
      status: "concluido";
      extractedText: string;
      chunks: Array<{ chunkIndex: number; text: string; page?: number | null; source: string }>;
    }
  | {
      status: "precisa_ocr" | "pendente";
      extractedText: null;
      chunks: [];
      reason: string;
    };

export function splitDocumentTextIntoChunks(text: string, chunkSize = 2400) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks: Array<{ chunkIndex: number; text: string; page?: number | null; source: string }> = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push({
      chunkIndex: chunks.length,
      text: normalized.slice(index, index + chunkSize),
      page: null,
      source: "extracted_text",
    });
  }
  return chunks;
}

export async function extractTextFromDocument({
  buffer,
  mimeType,
}: {
  buffer: Buffer;
  mimeType: string | null;
  filename: string;
}): Promise<DocumentProcessingOutcome> {
  if (mimeType === "text/plain") {
    const extractedText = buffer.toString("utf8").replace(/\0/g, "").trim();
    return {
      status: "concluido",
      extractedText,
      chunks: splitDocumentTextIntoChunks(extractedText),
    };
  }

  if (mimeType?.startsWith("image/")) {
    return {
      status: "precisa_ocr",
      extractedText: null,
      chunks: [],
      reason: "Imagem requer OCR em fase futura.",
    };
  }

  return {
    status: "pendente",
    extractedText: null,
    chunks: [],
    reason: "Extracao automatica para este formato ficara para a Fase 2.",
  };
}

