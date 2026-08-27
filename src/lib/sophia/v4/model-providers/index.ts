import type { SophiaV4ModelProvider } from "@/lib/sophia/v4/model-providers/types";
import { createGeminiV4Provider } from "@/lib/sophia/v4/model-providers/gemini";
import { createOpenAiCompatibleV4Provider } from "@/lib/sophia/v4/model-providers/openai-compatible";
import { createLocalStubProvider } from "@/lib/sophia/v4/model-providers/local-stub";

export function getSophiaV4ModelProvider(): SophiaV4ModelProvider {
  const selected = process.env.SOPHIA_MODEL_PROVIDER ?? "gemini";
  if (selected === "openai_compatible") {
    const provider = createOpenAiCompatibleV4Provider();
    return provider.available ? provider : createLocalStubProvider();
  }
  if (selected === "local_stub") return createLocalStubProvider();
  const gemini = createGeminiV4Provider();
  return gemini.available ? gemini : createLocalStubProvider();
}

export type { SophiaV4ModelProvider, SophiaV4ModelProviderName } from "@/lib/sophia/v4/model-providers/types";
