import { NextResponse } from "next/server";
import OpenAI from "openai";
import { formatAiContext, getAiContextForUser } from "@/lib/ai-context";
import { aiChatSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 10;
const systemInstructions =
  "Voce e o assistente interno do GeoGestao. Responda em portugues do Brasil. Ajude com gestao de propostas, contratos, servicos, financeiro, documentos e textos. Nao invente dados. Quando nao souber, diga que nao encontrou informacao suficiente. Nesta fase, voce nao altera dados no sistema.";

function checkRateLimit(userId: string) {
  const now = Date.now();
  const current = rateLimit.get(userId);
  if (!current || current.resetAt < now) {
    rateLimit.set(userId, { count: 1, resetAt: now + rateLimitWindowMs });
    return true;
  }

  if (current.count >= maxRequestsPerWindow) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessao expirada. Faca login novamente." }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Muitas mensagens em pouco tempo. Aguarde um minuto e tente novamente." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Mensagem invalida." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor." },
      { status: 500 },
    );
  }

  try {
    const contextText = await getSafeContextText(supabase, user.id);
    const messages = normalizeChatMessages(parsed.data);
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.5",
      instructions: systemInstructions,
      input: [
        "Contexto seguro da organizacao logada:",
        contextText,
        "",
        "Historico recente do chat:",
        messages.map((message) => `${message.role}: ${message.content}`).join("\n"),
      ].join("\n"),
      max_output_tokens: 700,
    });

    return NextResponse.json({
      message:
        response.output_text?.trim() ||
        "A IA respondeu sem texto utilizavel. Tente reformular a pergunta.",
    });
  } catch (error) {
    return handleOpenAiError(error);
  }
}

type ParsedChatInput = {
  message?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
};

function normalizeChatMessages(input: ParsedChatInput) {
  if (input.messages?.length) return input.messages;
  return [{ role: "user" as const, content: input.message ?? "" }];
}

async function getSafeContextText(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
) {
  try {
    return formatAiContext(await getAiContextForUser(supabase, userId));
  } catch (error) {
    console.warn("AI context unavailable", safeErrorLog(error));
    return "Contexto estruturado da empresa indisponivel nesta resposta.";
  }
}

function handleOpenAiError(error: unknown) {
  const info = safeErrorLog(error);
  const combined = `${info.code ?? ""} ${info.type ?? ""} ${info.message ?? ""}`.toLowerCase();

  if (info.status === 401 || info.status === 403) {
    return NextResponse.json(
      { error: "Chave da OpenAI inválida ou sem permissão." },
      { status: info.status },
    );
  }

  if (
    info.status === 429 ||
    combined.includes("quota") ||
    combined.includes("billing") ||
    combined.includes("credit") ||
    combined.includes("limit")
  ) {
    return NextResponse.json(
      {
        error:
          "Conta da OpenAI API sem créditos, sem billing ativo ou limite de uso atingido.",
      },
      { status: 429 },
    );
  }

  if (
    combined.includes("model") ||
    combined.includes("unsupported") ||
    combined.includes("not found")
  ) {
    return NextResponse.json(
      { error: "Modelo de IA indisponível ou sem acesso. Verifique OPENAI_MODEL." },
      { status: 400 },
    );
  }

  console.error("OpenAI chat error", info);
  return NextResponse.json(
    { error: "Nao foi possivel obter resposta da IA agora. Tente novamente em instantes." },
    { status: 500 },
  );
}

function safeErrorLog(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: typeof error === "string" ? error.slice(0, 200) : null };
  }

  const record = error as Record<string, unknown>;
  const status = typeof record.status === "number" ? record.status : undefined;
  const code = typeof record.code === "string" ? record.code : undefined;
  const type = typeof record.type === "string" ? record.type : undefined;
  const message = typeof record.message === "string" ? record.message.slice(0, 200) : null;

  return { status, code, type, message };
}
