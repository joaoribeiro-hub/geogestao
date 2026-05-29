import { describe, expect, it } from "vitest";
import { extractTextFromDocument, splitDocumentTextIntoChunks } from "@/lib/documents/processing";
import {
  buildDocumentStoragePath,
  hasStorageQuota,
  isAllowedDocumentMimeType,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  sanitizeDocumentFileName,
  validateDocumentFile,
} from "@/lib/documents/storage";

describe("DOCUMENTS-STORAGE-ARCH-1 storage helpers", () => {
  it("monta paths sempre dentro da organizacao", () => {
    expect(
      buildDocumentStoragePath({
        organizationId: "org-1",
        documentId: "doc-1",
        originalName: "Matricula atualizada.pdf",
        clientId: "client-1",
        propertyId: "property-1",
      }),
    ).toBe("organizations/org-1/clients/client-1/properties/property-1/documents/doc-1/Matricula-atualizada.pdf");
  });

  it("usa sem_cliente e sem_imovel quando faltam vinculos", () => {
    expect(
      buildDocumentStoragePath({
        organizationId: "org-1",
        documentId: "doc-1",
        originalName: "documento.pdf",
      }),
    ).toBe("organizations/org-1/clients/sem_cliente/properties/sem_imovel/documents/doc-1/documento.pdf");
  });

  it("monta paths especificos para servico, RH e empresa", () => {
    expect(
      buildDocumentStoragePath({
        organizationId: "org-1",
        documentId: "doc-1",
        originalName: "servico.pdf",
        serviceId: "service-1",
      }),
    ).toBe("organizations/org-1/services/service-1/documents/doc-1/servico.pdf");
    expect(
      buildDocumentStoragePath({
        organizationId: "org-1",
        documentId: "doc-1",
        originalName: "rh.pdf",
        employeeId: "employee-1",
      }),
    ).toBe("organizations/org-1/hr/employee-1/documents/doc-1/rh.pdf");
    expect(
      buildDocumentStoragePath({
        organizationId: "org-1",
        documentId: "doc-1",
        originalName: "empresa.pdf",
        relatedType: "company",
      }),
    ).toBe("organizations/org-1/documents/doc-1/empresa.pdf");
  });

  it("sanitiza nome e rejeita mime/tamanho invalidos", () => {
    expect(sanitizeDocumentFileName("Matrícula rural nº 1256.pdf")).toBe("Matricula-rural-n-1256.pdf");
    expect(isAllowedDocumentMimeType("application/pdf")).toBe(true);
    expect(validateDocumentFile({ sizeBytes: MAX_DOCUMENT_FILE_SIZE_BYTES + 1, mimeType: "application/pdf" })).toEqual({
      ok: false,
      reason: "O arquivo deve ter no maximo 50 MB.",
    });
    expect(validateDocumentFile({ sizeBytes: 100, mimeType: "application/x-msdownload" })).toEqual({
      ok: false,
      reason: "Tipo de arquivo nao permitido para documentos.",
    });
  });

  it("calcula quota considerando usado e reservado", () => {
    expect(hasStorageQuota({ usedBytes: 100, reservedBytes: 50, quotaBytes: 200, incomingBytes: 50 })).toBe(true);
    expect(hasStorageQuota({ usedBytes: 100, reservedBytes: 60, quotaBytes: 200, incomingBytes: 50 })).toBe(false);
  });
});

describe("DOCUMENTS-STORAGE-ARCH-1 processing helpers", () => {
  it("extrai texto de TXT e cria chunks", async () => {
    const outcome = await extractTextFromDocument({
      buffer: Buffer.from("Linha 1\nLinha 2"),
      mimeType: "text/plain",
      filename: "notas.txt",
    });
    expect(outcome.status).toBe("concluido");
    expect(outcome.extractedText).toContain("Linha 1");
    expect(outcome.chunks).toHaveLength(1);
  });

  it("marca imagens como precisa_ocr", async () => {
    const outcome = await extractTextFromDocument({
      buffer: Buffer.from([]),
      mimeType: "image/png",
      filename: "scan.png",
    });
    expect(outcome.status).toBe("precisa_ocr");
  });

  it("divide textos longos em chunks ordenados", () => {
    const chunks = splitDocumentTextIntoChunks("a".repeat(5000), 2000);
    expect(chunks).toHaveLength(3);
    expect(chunks[2].chunkIndex).toBe(2);
  });
});

