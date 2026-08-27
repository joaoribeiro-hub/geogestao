import type { Json } from "@/types/database";

export type SophiaV4ModelProviderName = "gemini" | "openai_compatible" | "local_stub";

export type SophiaV4ModelProvider = {
  name: SophiaV4ModelProviderName;
  model: string;
  available: boolean;
  generateJson(prompt: string): Promise<Record<string, Json> | null>;
};
