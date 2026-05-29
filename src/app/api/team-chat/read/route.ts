import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { getConversationKey } from "@/lib/team-communications/conversations";

const markReadSchema = z.object({
  scope: z.enum(["general", "direct"]).default("general"),
  recipientUserId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Conversa invalida." }, { status: 400 });
  }

  const recipientUserId = parsed.data.scope === "direct" ? parsed.data.recipientUserId : null;
  if (parsed.data.scope === "direct") {
    if (!recipientUserId || recipientUserId === user.id) {
      return NextResponse.json({ error: "Membro da conversa direta invalido." }, { status: 400 });
    }
    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization.id)
      .eq("user_id", recipientUserId)
      .eq("status", "active")
      .maybeSingle();
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
    if (!member) return NextResponse.json({ error: "Membro da conversa direta nao encontrado." }, { status: 404 });
  }

  const conversationKey = getConversationKey({
    scope: parsed.data.scope,
    currentUserId: user.id,
    recipientUserId,
  });

  const { error } = await supabase.from("team_chat_reads").upsert(
    {
      organization_id: organization.id,
      user_id: user.id,
      conversation_key: conversationKey,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id,conversation_key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
