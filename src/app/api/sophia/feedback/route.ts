import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { recordSophiaV4Feedback } from "@/lib/sophia/v4/reflexion-loop";

const schema = z.object({
  run_id: z.string().uuid().optional().nullable(),
  message_id: z.string().uuid().optional().nullable(),
  rating: z.enum(["like", "dislike", "positive", "negative"]),
  correction: z.string().trim().max(4000).optional().nullable(),
  expected_behavior: z.string().trim().max(4000).optional().nullable(),
  original_answer: z.string().trim().max(8000).optional().nullable(),
  question: z.string().trim().max(2000).optional().nullable(),
  user_feedback: z.string().trim().max(4000).optional().nullable(),
  failed_intent: z.string().trim().max(160).optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Feedback invalido." }, { status: 400 });
  if (["like", "positive"].includes(parsed.data.rating)) return NextResponse.json({ ok: true, reflectionId: null });

  const feedback = parsed.data.user_feedback ?? parsed.data.correction ?? "A resposta precisa ser revisada.";
  const result = await recordSophiaV4Feedback({
    context: { supabase, organizationId: organization.id, user, membership, isOwner: membership.role === "owner" },
    runId: parsed.data.run_id,
    messageId: parsed.data.message_id,
    question: parsed.data.question ?? parsed.data.failed_intent ?? "Pergunta nao informada.",
    answer: parsed.data.original_answer ?? "Resposta da Sophia nao informada.",
    feedback,
    correction: parsed.data.correction,
  });
  return NextResponse.json({ ok: true, ...result, ownerReviewRequired: membership.role !== "owner" || Boolean(result.candidateId) });
}
