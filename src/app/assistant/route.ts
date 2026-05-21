import { NextResponse } from "next/server";
import { detectIntentWithGemini } from "@/lib/assistant/gemini";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, error: "Mensagem inválida." },
        { status: 400 }
      );
    }

    const result = await detectIntentWithGemini(message);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error("Erro no assistente:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao conversar com o Gemini.",
      },
      { status: 500 }
    );
  }
}