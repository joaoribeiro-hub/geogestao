export type StorageQuotaInput = {
  usedBytes: number;
  quotaMb: number;
  incomingBytes: number;
};

export function mbToBytes(value: number) {
  return Math.max(0, Number(value || 0)) * 1024 * 1024;
}

export function calculateStorageUsage(
  files: Array<{ file_size?: number | null; size_bytes?: number | null }>,
) {
  return files.reduce(
    (total, file) => total + Number(file.file_size ?? file.size_bytes ?? 0),
    0,
  );
}

export function canUseStorage({
  usedBytes,
  quotaMb,
  incomingBytes,
}: StorageQuotaInput) {
  return usedBytes + incomingBytes <= mbToBytes(quotaMb);
}

export function formatStorageLimitMessage() {
  return "Limite de armazenamento do plano atingido.";
}
