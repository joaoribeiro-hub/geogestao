export const UNIVERSAL_CONTENT_BUCKET = "attachments";
export const UNIVERSAL_CONTENT_MAX_BYTES = 50 * 1024 * 1024;

export const UNIVERSAL_CONTENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
]);

export type UniversalDocumentCategory = "legislacao" | "anexos";

export function sanitizeUniversalFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 160);
  return normalized || "arquivo";
}

export function buildUniversalDocumentPath(
  category: UniversalDocumentCategory,
  documentId: string,
  fileName: string,
) {
  return `global/universal-documents/${category}/${documentId}/${sanitizeUniversalFileName(fileName)}`;
}

export function buildUniversalAnnouncementPath(announcementId: string, fileName: string) {
  return `global/universal-announcements/${announcementId}/${sanitizeUniversalFileName(fileName)}`;
}

export function validateUniversalFile(input: { size: number; type?: string | null }) {
  if (!Number.isFinite(input.size) || input.size <= 0) return "O arquivo esta vazio ou e invalido.";
  if (input.size > UNIVERSAL_CONTENT_MAX_BYTES) return "O arquivo ultrapassa o limite de 50 MB.";
  if (input.type && !UNIVERSAL_CONTENT_MIME_TYPES.has(input.type)) return "Este tipo de arquivo nao e permitido.";
  return null;
}
