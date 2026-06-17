import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatMemberCurrentWorkMessage, getMemberCurrentWorkStatusFromItems } from "@/lib/assistant/checklist-status";
import { inferCorrectedIntentFromCorrection, sanitizeAssistantFeedbackText } from "@/lib/assistant/feedback-sanitizer";

describe("AI-ASSISTANT-CONTEXT-LEARNING-2", () => {
  it("cria migration para aprendizado global sanitizado", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/028_assistant_context_learning.sql"),
      "utf8",
    );

    expect(migration).toContain("assistant_global_learning_examples");
    expect(migration).toContain("conversation_context");
    expect(migration).toContain("is_resolved");
    expect(migration).toContain("privacy_level = 'global_sanitized'");
    expect(migration).toContain("enable row level security");
  });

  it("infere item atual pelo primeiro aberto depois do ultimo concluido", () => {
    const status = getMemberCurrentWorkStatusFromItems([
      {
        id: "1",
        title: "Projetar Fazenda Pinfa Fogo",
        status: "done",
        created_at: "2026-05-21T08:00:00.000Z",
        completed_at: "2026-05-21T09:00:00.000Z",
      },
      {
        id: "2",
        title: "Caracterizar o projeto Planta_CAR_1",
        status: "open",
        created_at: "2026-05-21T09:10:00.000Z",
        completed_at: null,
      },
    ]);

    expect(status.completedItems.map((item) => item.title)).toEqual(["Projetar Fazenda Pinfa Fogo"]);
    expect(status.currentItem?.title).toBe("Caracterizar o projeto Planta_CAR_1");
  });

  it("formata resposta listando concluidos e item atual", () => {
    const message = formatMemberCurrentWorkMessage({
      memberName: "Joao Pedro",
      dateLabel: "21/05/2026",
      completedTitles: ["Projetar Fazenda Pinfa Fogo"],
      currentTitle: "Caracterizar o projeto Planta_CAR_1",
      lastActivityText: "marcou Projetar Fazenda Pinfa Fogo como concluido as 09:00",
    });

    expect(message).toContain("**Joao Pedro** concluiu:");
    expect(message).toContain("* **Projetar Fazenda Pinfa Fogo**;");
    expect(message).toContain("Agora ele provavelmente esta fazendo:");
    expect(message).toContain("* **Caracterizar o projeto Planta_CAR_1**;");
  });

  it("sanitiza feedback negativo antes de virar exemplo global", () => {
    const sanitized = sanitizeAssistantFeedbackText(
      "Deveria buscar o checklist do membro Joao Pedro sobre Fazenda Pinfa Fogo, email joao@example.com e valor R$ 1.200,50.",
    );

    expect(sanitized).not.toContain("Joao Pedro");
    expect(sanitized).not.toContain("Fazenda Pinfa Fogo");
    expect(sanitized).not.toContain("joao@example.com");
    expect(sanitized).not.toContain("1.200,50");
    expect(sanitized).toContain("[MEMBRO]");
  });

  it("classifica correcao de checklist de membro como status atual", () => {
    expect(
      inferCorrectedIntentFromCorrection("Deveria buscar checklist do membro Joao Pedro e dizer o que ele esta fazendo agora."),
    ).toBe("list_member_current_status");
  });
});
