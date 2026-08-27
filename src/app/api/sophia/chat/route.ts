import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { runSophiaChat } from "@/lib/sophia/runner";
import type { Json } from "@/types/database";
import type { SophiaAttachmentReference } from "@/lib/sophia/types";

const sophiaChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional().nullable(),
  context: z
    .object({
      pathname: z.string().optional().nullable(),
      entityType: z.string().optional().nullable(),
      entityId: z.string().uuid().optional().nullable(),
    })
    .optional()
    .nullable(),
  conversationContext: z.unknown().optional().nullable(),
  correctionContext: z.unknown().optional().nullable(),
  confirmation: z
    .object({
      actionName: z.string().min(1),
      params: z.record(z.unknown()).default({}),
      selectedClientId: z.string().uuid().optional(),
    })
    .optional()
    .nullable(),
  attachments: z.array(z.object({
    inboxItemId: z.string().uuid(),
    fileName: z.string().min(1).max(240),
    mimeType: z.string().min(1).max(160),
    sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
    storagePath: z.string().min(1).max(500),
    source: z.literal("sophia_chat"),
  })).max(3).default([]),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = sophiaChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensagem invalida para a Sophia." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership) {
    return NextResponse.json({ error: "Conclua o onboarding da empresa para usar a Sophia." }, { status: 403 });
  }

  const attachments = parsed.data.attachments as SophiaAttachmentReference[];
  if (attachments.length) {
    const inbox = supabase as unknown as {
      from(table: string): {
        select(columns: string): {
          in(column: string, values: string[]): {
            eq(column: string, value: string): {
              eq(column: string, value: string): Promise<{ data: Array<{ id: string; storage_path: string }> | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
    const { data: storedAttachments, error: attachmentError } = await inbox
      .from("sophia_inbox_items")
      .select("id,storage_path")
      .in("id", attachments.map((item) => item.inboxItemId))
      .eq("organization_id", organization.id)
      .eq("user_id", user.id);
    if (attachmentError || (storedAttachments ?? []).length !== attachments.length) {
      return NextResponse.json({ error: "Anexo invalido para a organizacao atual." }, { status: 403 });
    }
    const validPaths = new Map((storedAttachments ?? []).map((item) => [item.id, item.storage_path]));
    if (attachments.some((item) => validPaths.get(item.inboxItemId) !== item.storagePath)) {
      return NextResponse.json({ error: "Caminho de anexo invalido." }, { status: 403 });
    }
  }

  try {
    const response = await runSophiaChat({
      context: {
        supabase,
        user,
        organizationId: organization.id,
        membership,
        isOwner: membership.role === "owner",
      },
      message: parsed.data.message,
      requestContext: {
        conversationId: parsed.data.conversationId,
        pathname: parsed.data.context?.pathname ?? null,
        entityType: parsed.data.context?.entityType ?? null,
        entityId: parsed.data.context?.entityId ?? null,
        attachments,
      },
      confirmation: parsed.data.confirmation
        ? {
            actionName: parsed.data.confirmation.actionName,
            params: parsed.data.confirmation.params as Record<string, Json>,
            selectedClientId: parsed.data.confirmation.selectedClientId,
          }
        : null,
    });
    return NextResponse.json(response);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[sophia:chat]", error instanceof Error ? error.message : error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel executar a Sophia agora." },
      { status: 500 },
    );
  }
}
