import { NextResponse } from "next/server";
import { z } from "zod";
import { inferCorrectedIntentFromCorrection, sanitizeAssistantFeedbackText } from "@/lib/assistant/feedback-sanitizer";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const feedbackSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  messageId: z.string().uuid().optional().nullable(),
  messageText: z.string().trim().min(1).max(2000),
  assistantResponse: z.string().trim().min(1).max(4000),
  detectedIntent: z.string().optional().nullable(),
  detectedParams: z.record(z.unknown()).optional().default({}),
  rating: z.enum(["positive", "negative"]),
  correctionText: z.string().trim().max(2000).optional().nullable(),
  source: z.string().optional().nullable(),
  conversationContext: z.record(z.unknown()).optional().default({}),
  resolvedFeedbackId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Feedback invalido." }, { status: 400 });
  }

  if (parsed.data.rating === "positive" && parsed.data.resolvedFeedbackId) {
    await supabase
      .from("assistant_feedback")
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", parsed.data.resolvedFeedbackId)
      .eq("organization_id", organization.id);
  }

  const correctedIntent = parsed.data.correctionText
    ? inferCorrectedIntentFromCorrection(parsed.data.correctionText)
    : null;
  const { data: feedback, error } = await supabase.from("assistant_feedback").insert({
    organization_id: organization.id,
    user_id: user.id,
    conversation_id: parsed.data.conversationId ?? null,
    message_id: parsed.data.messageId ?? null,
    message_text: parsed.data.messageText,
    assistant_response: parsed.data.assistantResponse,
    detected_intent: parsed.data.detectedIntent ?? null,
    detected_params: parsed.data.detectedParams as Json,
    rating: parsed.data.rating,
    correction_text: parsed.data.correctionText ?? null,
    corrected_intent: correctedIntent,
    source: parsed.data.source ?? null,
    conversation_context: parsed.data.conversationContext as Json,
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sanitizedExampleId: string | null = null;
  if (parsed.data.rating === "negative" && parsed.data.correctionText) {
    const { data: sanitizedExample, error: sanitizedError } = await supabase
      .from("assistant_global_learning_examples")
      .insert({
        promoted_from_feedback_id: feedback.id,
        original_sanitized: sanitizeAssistantFeedbackText(parsed.data.messageText),
        correction_sanitized: sanitizeAssistantFeedbackText(parsed.data.correctionText),
        corrected_intent: correctedIntent,
        params_schema: {},
        source: "feedback_sanitized",
        is_sanitized: true,
        privacy_level: "global_sanitized",
        needs_review: false,
      })
      .select("id")
      .single();
    if (!sanitizedError) {
      sanitizedExampleId = sanitizedExample.id;
    } else if (process.env.NODE_ENV !== "production" && !isMissingGlobalLearningRelation(sanitizedError.message)) {
      console.warn("[assistant:feedback] nao foi possivel salvar exemplo sanitizado", {
        message: sanitizedError.message,
      });
    }
  }

  if (parsed.data.correctionText) {
    const globalExamples = (
      supabase as unknown as {
        from: (table: "assistant_feedback_examples") => {
          insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
        };
      }
    ).from("assistant_feedback_examples");
    const { error: globalExampleError } = await globalExamples.insert({
      original_prompt: sanitizeAssistantFeedbackText(parsed.data.messageText),
      correction_text: sanitizeAssistantFeedbackText(parsed.data.correctionText),
      resolved_intent: correctedIntent ?? parsed.data.detectedIntent ?? null,
      approved_response_pattern: sanitizeAssistantFeedbackText(parsed.data.assistantResponse),
      created_by: user.id,
      organization_id: organization.id,
      is_global_training: true,
      status: parsed.data.rating === "positive" ? "approved" : "pending",
    });
    if (
      globalExampleError &&
      process.env.NODE_ENV !== "production" &&
      !/assistant_feedback_examples/i.test(globalExampleError.message)
    ) {
      console.warn("[assistant:feedback] nao foi possivel salvar exemplo global", {
        message: globalExampleError.message,
      });
    }
  }

  await supabase.from("organization_activity_log").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    activity_type: parsed.data.rating === "positive"
      ? "assistant_feedback_positive"
      : "assistant_feedback_negative",
    entity_type: "assistant_message",
    entity_id: parsed.data.messageId ?? null,
    metadata: {
      detected_intent: parsed.data.detectedIntent ?? null,
      source: parsed.data.source ?? null,
      has_correction: Boolean(parsed.data.correctionText),
    },
  });

  return NextResponse.json({ ok: true, feedbackId: feedback.id, sanitizedExampleId });
}

function isMissingGlobalLearningRelation(message: string) {
  return /assistant_global_learning_examples/i.test(message) &&
    (/does not exist/i.test(message) || /schema cache/i.test(message));
}
