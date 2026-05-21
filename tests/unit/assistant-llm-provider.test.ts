import { describe, expect, it, vi } from "vitest";
import { classifyIntentWithOptionalLlm } from "@/lib/assistant/llm-provider";

describe("assistant llm provider", () => {
  it("nao chama provedor externo quando AI_PROVIDER nao esta configurado", async () => {
    const previousProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(classifyIntentWithOptionalLlm("Quais servicos para hoje?")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    process.env.AI_PROVIDER = previousProvider;
  });
});
