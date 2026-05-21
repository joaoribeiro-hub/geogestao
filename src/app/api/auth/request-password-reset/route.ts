import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/auth-validation";
import { createServerSupabase } from "@/lib/supabase/server";

const genericMessage =
  "Se os dados estiverem corretos, enviaremos instrucoes para redefinir sua senha.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: true, message: genericMessage });
  }

  const supabase = await createServerSupabase();
  const { email, birthDate } = parsed.data;
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const { data: canReset, error } = await supabase.rpc("can_request_password_reset", {
    p_email: email,
    p_birth_date: birthDate,
  });

  if (!error && canReset) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
  }

  return NextResponse.json({ ok: true, message: genericMessage });
}
