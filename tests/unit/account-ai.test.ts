import { describe, expect, it } from "vitest";
import { extractOpenAiResponseText } from "@/lib/ai-context";
import {
  calculateStorageUsage,
  canUseStorage,
  formatStorageLimitMessage,
  mbToBytes,
} from "@/lib/services/storage-quota";
import { aiChatSchema, profileSchema } from "@/lib/schemas";

describe("ACCOUNT-1 account and AI helpers", () => {
  it("calcula armazenamento usado e valida quota do plano", () => {
    const usedBytes = calculateStorageUsage([
      { file_size: 1024 },
      { size_bytes: 2048 },
      { file_size: null, size_bytes: 512 },
    ]);

    expect(usedBytes).toBe(3584);
    expect(mbToBytes(1)).toBe(1024 * 1024);
    expect(canUseStorage({ usedBytes, quotaMb: 1, incomingBytes: 1000 })).toBe(true);
    expect(
      canUseStorage({
        usedBytes: mbToBytes(1),
        quotaMb: 1,
        incomingBytes: 1,
      }),
    ).toBe(false);
    expect(formatStorageLimitMessage()).toBe("Limite de armazenamento do plano atingido.");
  });

  it("valida dados de perfil e preferencias", () => {
    const parsed = profileSchema.parse({
      full_name: "  Ana Silva  ",
      phone: "",
      birth_date: "",
      document_type: "cpf",
      document_number: "123",
      avatar_path: "",
      email_preferences: {
        summaries: true,
        special_dates: false,
        projects: true,
        proposals: true,
        finance: false,
      },
      account_preferences: {
        compact_mode: false,
      },
    });

    expect(parsed.full_name).toBe("Ana Silva");
    expect(parsed.phone).toBeNull();
    expect(parsed.birth_date).toBeNull();
    expect(parsed.avatar_path).toBeNull();
    expect(parsed.email_preferences.finance).toBe(false);
  });

  it("limita mensagem do chat e extrai texto da resposta da OpenAI", () => {
    expect(aiChatSchema.safeParse({ message: "" }).success).toBe(false);
    expect(aiChatSchema.safeParse({ message: "Resumo das propostas" }).success).toBe(true);
    expect(
      extractOpenAiResponseText({
        output: [{ content: [{ text: "Resposta segura" }] }],
      }),
    ).toBe("Resposta segura");
  });
});
