import type { Json } from "@/types/database";

export type SophiaModelProviderName = "gemini" | "openai_compatible";
export type SophiaModelProvider = {
  name: SophiaModelProviderName;
  model: string;
  generateJson(prompt: string): Promise<Record<string, Json> | null>;
};

export function getSophiaModelProvider(): SophiaModelProvider | null {
  const name = process.env.SOPHIA_MODEL_PROVIDER === "openai_compatible" ? "openai_compatible" : "gemini";
  if (name === "openai_compatible") {
    const baseUrl = process.env.SOPHIA_OPENAI_COMPATIBLE_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.SOPHIA_OPENAI_COMPATIBLE_API_KEY;
    const model = process.env.SOPHIA_OPENAI_COMPATIBLE_MODEL;
    if (!baseUrl || !apiKey || !model) return null;
    return { name, model, generateJson: (prompt) => requestOpenAiCompatible<TypedJson>(baseUrl, apiKey, model, prompt) };
  }
  if (!process.env.GEMINI_API_KEY) return null;
  return null;
}

async function requestOpenAiCompatible<T>(baseUrl: string, apiKey: string, model: string, prompt: string) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;
  try { return JSON.parse(content) as T; } catch { return null; }
}

type TypedJson = Record<string, Json>;
