const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\d)(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}(?!\d)/g;
const CPF_CNPJ = /(?<!\d)(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})(?!\d)/g;
const CAR = /\b[A-Z]{2}-\d{7}-[A-F0-9]{32}\b/gi;
const MONEY = /\bR\$\s*\d[\d.,]*|\b\d[\d.,]*\s*(?:reais|real)\b/gi;

export function sanitizeSophiaPrivateText(
  value: string,
  context: { clientNames?: string[]; serviceNames?: string[]; propertyNames?: string[] } = {},
) {
  let sanitized = value
    .replace(EMAIL, "[EMAIL]")
    .replace(PHONE, "[TELEFONE]")
    .replace(CPF_CNPJ, "[DOCUMENTO]")
    .replace(CAR, "[CODIGO_CAR]")
    .replace(MONEY, "[VALOR]");
  const contextual = [
    ...(context.clientNames ?? []),
    ...(context.serviceNames ?? []),
    ...(context.propertyNames ?? []),
  ].filter((item) => item.trim().length >= 3).sort((left, right) => right.length - left.length);
  for (const item of contextual) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(item), "gi"), "[ENTIDADE_PRIVADA]");
  }
  return sanitized;
}

export function sanitizeSophiaGlobalTemplate(value: unknown, context?: Parameters<typeof sanitizeSophiaPrivateText>[1]) {
  return sanitizeSophiaPrivateText(JSON.stringify(value ?? {}), context).slice(0, 12000);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
