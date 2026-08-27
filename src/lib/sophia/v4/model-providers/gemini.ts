import { GoogleGenAI } from "@google/genai";
import type { Json } from "@/types/database";
import type { SophiaV4ModelProvider } from "@/lib/sophia/v4/model-providers/types";

export function createGeminiV4Provider(): SophiaV4ModelProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  return {
    name: "gemini",
    model,
    available: Boolean(apiKey),
    async generateJson(prompt: string) {
      if (!apiKey) return null;
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 0, responseMimeType: "application/json" } });
        const text = response.text?.trim();
        return text ? JSON.parse(text) as Record<string, Json> : null;
      } catch {
        return null;
      }
    },
  };
}
