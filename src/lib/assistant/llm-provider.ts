import type { AssistantIntentDetection } from "@/lib/assistant/types";

const systemInstruction = `Voce classifica mensagens para o Assistente IA do GeoGestao.
Responda somente JSON valido com: intent, params, confidence, responseDraft, requiresConfirmation.
Nao invente dados, nao gere SQL, nao diga que criou algo e nao execute acoes.
Intents permitidas: list_today_services, list_month_services, list_overdue_services, list_pending_tasks, list_inactive_clients, find_client_by_name, summarize_client, create_client_task, create_member_task, create_client_interaction, create_service, list_client_services, list_client_commercial_records, unknown.`;

export async function classifyIntentWithOptionalLlm(
  message: string,
): Promise<AssistantIntentDetection | null> {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!provider) return null;

  try {
    if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
      return parseDetection(
        await callOpenAiCompatible({
          url: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: process.env.OPENROUTER_API_KEY,
          model: process.env.OPENROUTER_MODEL ?? "google/gemini-flash-1.5",
          message,
        }),
      );
    }

    if (provider === "groq" && process.env.GROQ_API_KEY) {
      return parseDetection(
        await callOpenAiCompatible({
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
          message,
        }),
      );
    }

    if (provider === "gemini" && process.env.GEMINI_API_KEY) {
      return parseDetection(await callGemini({ apiKey: process.env.GEMINI_API_KEY, message }));
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[assistant:llm] classificacao externa indisponivel", safeError(error));
    }
  }

  return null;
}

async function callOpenAiCompatible({
  url,
  apiKey,
  model,
  message,
}: {
  url: string;
  apiKey: string;
  model: string;
  message: string;
}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) throw new Error(`LLM provider returned ${response.status}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}

async function callGemini({ apiKey, message }: { apiKey: string; message: string }) {
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0 },
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemInstruction}\n\nMensagem: ${message}` }],
          },
        ],
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function parseDetection(content: string | null): AssistantIntentDetection | null {
  if (!content) return null;
  const jsonText = content.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(jsonText) as Partial<AssistantIntentDetection> & {
    requiresConfirmation?: boolean;
  };
  if (!parsed.intent || typeof parsed.confidence !== "number") return null;
  return {
    intent: parsed.intent,
    confidence: parsed.confidence,
    params: parsed.params ?? {},
    responseDraft: parsed.responseDraft ?? null,
    needsConfirmation: Boolean(parsed.needsConfirmation ?? parsed.requiresConfirmation),
  } as AssistantIntentDetection;
}

function safeError(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { message: "Erro desconhecido" };
}
