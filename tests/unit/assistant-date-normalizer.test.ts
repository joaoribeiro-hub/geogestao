import { describe, expect, it } from "vitest";
import { normalizeAssistantDate } from "@/lib/assistant/date-normalizer";

describe("assistant date normalizer", () => {
  const baseDate = new Date("2026-05-20T12:00:00.000Z");

  it("normaliza datas relativas em portugues", () => {
    expect(normalizeAssistantDate("hoje", baseDate)).toBe("2026-05-20");
    expect(normalizeAssistantDate("amanha", baseDate)).toBe("2026-05-21");
    expect(normalizeAssistantDate("amanhã", baseDate)).toBe("2026-05-21");
    expect(normalizeAssistantDate("depois de amanha", baseDate)).toBe("2026-05-22");
    expect(normalizeAssistantDate("daqui dois", baseDate)).toBe("2026-05-22");
    expect(normalizeAssistantDate("daqui 3 dias", baseDate)).toBe("2026-05-23");
    expect(normalizeAssistantDate("ontem", baseDate)).toBe("2026-05-19");
  });

  it("normaliza datas ISO e brasileiras", () => {
    expect(normalizeAssistantDate("2026-05-20", baseDate)).toBe("2026-05-20");
    expect(normalizeAssistantDate("20/05/2026", baseDate)).toBe("2026-05-20");
  });

  it("retorna null para data nao interpretavel", () => {
    expect(normalizeAssistantDate("algum dia", baseDate)).toBeNull();
  });
});
