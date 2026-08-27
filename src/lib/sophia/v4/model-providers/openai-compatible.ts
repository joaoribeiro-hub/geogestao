import type { Json } from "@/types/database";
import type { SophiaV4ModelProvider } from "@/lib/sophia/v4/model-providers/types";

export function createOpenAiCompatibleV4Provider(): SophiaV4ModelProvider {
  const baseUrl = process.env.SOPHIA_OPENAI_COMPATIBLE_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.SOPHIA_OPENAI_COMPATIBLE_API_KEY;
  const model = process.env.SOPHIA_OPENAI_COMPATIBLE_MODEL ?? "";
  return {
    name: "openai_compatible",
    model,
    available: Boolean(baseUrl && apiKey && model),
    async generateJson(prompt: string) {
      if (!baseUrl || !apiKey || !model) return null;
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
      }).catch(() => null);
      if (!response?.ok) return null;
      const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;
      try { return JSON.parse(content) as Record<string, Json>; } catch { return null; }
    },
  };
}
