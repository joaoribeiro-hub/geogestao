import { normalizeAssistantText } from "@/lib/assistant/intent-detector";

const entityPatterns = [
  /\b(?:funcionario|membro|colaborador|colaboradora)\s*(?:\([^)]*\))?\s+(\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,4})/gu,
  /\b(?:cliente|imovel|fazenda|propriedade)\s+(\p{Lu}[\p{L}'_-]+(?:\s+\p{Lu}[\p{L}'_-]+){0,5})/gu,
];

export function sanitizeAssistantFeedbackText(text: string) {
  let sanitized = text;

  sanitized = sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]");
  sanitized = sanitized.replace(/\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}\b/g, "[TELEFONE]");
  sanitized = sanitized.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[DOCUMENTO]");
  sanitized = sanitized.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[DOCUMENTO]");
  sanitized = sanitized.replace(/\bR?\$?\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})\b/gi, "[VALOR]");
  sanitized = sanitized.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[DATA]");
  sanitized = sanitized.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[DATA]");

  for (const pattern of entityPatterns) {
    sanitized = sanitized.replace(pattern, (match, entity: string) => {
      const normalized = normalizeAssistantText(match);
      if (normalized.startsWith("funcionario") || normalized.startsWith("membro") || normalized.startsWith("colaborador")) {
        return match.replace(entity, "[MEMBRO]");
      }
      if (normalized.startsWith("cliente")) return match.replace(entity, "[CLIENTE]");
      return match.replace(entity, "[IMOVEL]");
    });
  }

  sanitized = sanitized.replace(/\b(\p{Lu}[\p{L}'_-]+(?:\s+\p{Lu}[\p{L}'_-]+){1,4})\b/gu, (match) => {
    if (["GeoGestao", "Assistente IA"].includes(match)) return match;
    return "[NOME]";
  });

  return sanitized.replace(/\s+/g, " ").trim();
}

export function inferCorrectedIntentFromCorrection(correctionText: string) {
  const normalized = normalizeAssistantText(correctionText);
  if (
    normalized.includes("checklist") &&
    (normalized.includes("membro") || normalized.includes("funcionario") || normalized.includes("colaborador"))
  ) {
    return normalized.includes("fazendo agora") || normalized.includes("atividade")
      ? "list_member_current_status"
      : "list_member_checklist";
  }
  if (normalized.includes("atividade") && (normalized.includes("membro") || normalized.includes("funcionario"))) {
    return "list_member_current_status";
  }
  if (normalized.includes("criar") && normalized.includes("servico")) return "create_service";
  if (normalized.includes("tarefa") && normalized.includes("membro")) return "create_member_task";
  if (normalized.includes("cliente") && normalized.includes("resumo")) return "summarize_client";
  return null;
}
