import type { AttachmentEntityType } from "@/types/database";

export const organizationStorageFolders: Record<AttachmentEntityType, string> = {
  profile: "profiles",
  client: "clients",
  proposal: "proposals",
  service_card: "services",
  contract: "contracts",
  revenue: "finance/revenues",
  expense: "finance/expenses",
  document_template: "documents",
  legislation_item: "legislation",
};

export function getOrganizationEntityFolder(
  entityType: AttachmentEntityType,
  entityId?: string | null,
) {
  const base = organizationStorageFolders[entityType] ?? "general";
  return entityId ? `${base}/${entityId}` : base;
}

export function isOrganizationStoragePath(organizationId: string, storagePath: string | null | undefined) {
  return Boolean(storagePath?.startsWith(`organizations/${organizationId}/`));
}

export function isSharedStoragePath(storagePath: string | null | undefined) {
  return Boolean(storagePath?.startsWith("shared/"));
}

export function assertSafeOrganizationStoragePath(
  organizationId: string,
  storagePath: string | null | undefined,
) {
  if (!storagePath || !isOrganizationStoragePath(organizationId, storagePath)) {
    throw new Error("Caminho de arquivo fora da organizacao atual.");
  }
}

export function getStorageDisplayName({
  fileName,
  storagePath,
  fallback = "arquivo",
}: {
  fileName?: string | null;
  storagePath?: string | null;
  fallback?: string;
}) {
  if (fileName) return fileName;
  if (!storagePath) return fallback;
  return storagePath.split("/").filter(Boolean).at(-1) ?? fallback;
}
