import { normalizeExampleText } from "@/lib/assistant/intent-example-parser";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type AssistantIntentExampleMatch = {
  rawText: string;
  normalizedText: string;
  intentName: string;
  actionName: string;
  synonym: string | null;
};

export async function findSimilarIntentExamples(
  supabase: ServerSupabase,
  inputText: string,
  limit = 8,
): Promise<AssistantIntentExampleMatch[]> {
  const normalized = normalizeExampleText(inputText);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .slice(0, 6);

  if (!tokens.length) return [];

  const { data, error } = await supabase.rpc("find_assistant_intent_examples", {
    p_normalized_text: normalized,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[assistant:intent-examples] consulta indisponivel", {
        message: error.message,
      });
    }
    return [];
  }

  const baseMatches = (data ?? []).map((row) => ({
    rawText: row.raw_text,
    normalizedText: row.normalized_text,
    synonym: row.synonym ?? null,
    intentName: row.intent_name ?? "unknown",
    actionName: row.action_name ?? "unknown",
  }));
  const learnedMatches = await findSimilarGlobalLearningExamples(supabase, inputText, Math.max(2, Math.floor(limit / 3)));
  return [...learnedMatches, ...baseMatches].slice(0, Math.min(Math.max(limit, 1), 20));
}

export async function findSimilarGlobalLearningExamples(
  supabase: ServerSupabase,
  inputText: string,
  limit = 4,
): Promise<AssistantIntentExampleMatch[]> {
  const normalized = normalizeExampleText(inputText);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .slice(0, 8);
  if (!tokens.length) return [];

  const { data, error } = await supabase
    .from("assistant_global_learning_examples")
    .select("original_sanitized,correction_sanitized,corrected_intent")
    .eq("is_active", true)
    .eq("is_sanitized", true)
    .eq("privacy_level", "global_sanitized")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (process.env.NODE_ENV !== "production" && !/assistant_global_learning_examples/i.test(error.message)) {
      console.warn("[assistant:intent-examples] exemplos sanitizados indisponiveis", {
        message: error.message,
      });
    }
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const rawText = `${row.original_sanitized} => ${row.correction_sanitized}`;
      const normalizedText = normalizeExampleText(rawText);
      const score = tokens.reduce((total, token) => total + (normalizedText.includes(token) ? 1 : 0), 0);
      return {
        score,
        match: {
          rawText,
          normalizedText,
          synonym: "feedback_sanitized",
          intentName: row.corrected_intent ?? "unknown",
          actionName: row.corrected_intent ?? "unknown",
        } satisfies AssistantIntentExampleMatch,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(Math.max(limit, 1), 20))
    .map((item) => item.match);
}

export async function getIntentExamplesByIntent(
  supabase: ServerSupabase,
  intentName: string,
  limit = 8,
) {
  const { data, error } = await supabase
    .from("assistant_intent_examples")
    .select("raw_text,normalized_text,synonym,assistant_intents!inner(name,action_name)")
    .eq("assistant_intents.name", intentName)
    .eq("is_active", true)
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listActiveIntents(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from("assistant_intents")
    .select("name,description,action_name,category")
    .eq("enabled", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
