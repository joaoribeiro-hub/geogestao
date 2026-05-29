export const DOCUMENTS_BUCKET = "documentos";
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export type DocumentUploadTarget = {
  organizationId: string;
  documentId: string;
  originalName: string;
  clientId?: string | null;
  propertyId?: string | null;
  serviceId?: string | null;
  employeeId?: string | null;
  relatedType?: string | null;
};

export function isAllowedDocumentMimeType(mimeType: string | null | undefined) {
  return ALLOWED_DOCUMENT_MIME_TYPES.includes((mimeType ?? "") as AllowedDocumentMimeType);
}

export function validateDocumentFile({
  sizeBytes,
  mimeType,
}: {
  sizeBytes: number;
  mimeType: string | null | undefined;
}) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false as const, reason: "Arquivo invalido." };
  }
  if (sizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return { ok: false as const, reason: "O arquivo deve ter no maximo 50 MB." };
  }
  if (!isAllowedDocumentMimeType(mimeType)) {
    return { ok: false as const, reason: "Tipo de arquivo nao permitido para documentos." };
  }
  return { ok: true as const };
}

export function sanitizeDocumentFileName(fileName: string) {
  const trimmed = fileName.trim();
  const fallback = "documento";
  const normalized = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
  return normalized || fallback;
}

export function buildDocumentStoragePath(target: DocumentUploadTarget) {
  const organizationPrefix = `organizations/${target.organizationId}`;
  const safeName = sanitizeDocumentFileName(target.originalName);

  if (target.serviceId) {
    return `${organizationPrefix}/services/${target.serviceId}/documents/${target.documentId}/${safeName}`;
  }

  if (target.employeeId) {
    return `${organizationPrefix}/hr/${target.employeeId}/documents/${target.documentId}/${safeName}`;
  }

  if (target.relatedType === "company") {
    return `${organizationPrefix}/documents/${target.documentId}/${safeName}`;
  }

  const clientSegment = target.clientId ?? "sem_cliente";
  const propertySegment = target.propertyId ?? "sem_imovel";
  return `${organizationPrefix}/clients/${clientSegment}/properties/${propertySegment}/documents/${target.documentId}/${safeName}`;
}

export function assertDocumentStoragePath(organizationId: string, storagePath: string | null | undefined) {
  if (!storagePath?.startsWith(`organizations/${organizationId}/`)) {
    throw new Error("Caminho de documento fora da organizacao atual.");
  }
}

export function hasStorageQuota({
  usedBytes,
  reservedBytes,
  quotaBytes,
  incomingBytes,
}: {
  usedBytes: number;
  reservedBytes: number;
  quotaBytes: number;
  incomingBytes: number;
}) {
  return usedBytes + reservedBytes + incomingBytes <= quotaBytes;
}

export function formatDocumentBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

