import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { previewMessage } from "@/lib/team-communications/badges";
import type { TeamChatMessage } from "@/types/database";

const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("team_chat_messages")
    .select("*")
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = [...(data ?? [])].reverse();
  const decoratedMessages = await decorateMessages(supabase, organization.id, user.id, messages);

  return NextResponse.json({
    organizationId: organization.id,
    messages: decoratedMessages,
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensagem invalida." }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("team_chat_messages")
    .insert({
      organization_id: organization.id,
      sender_user_id: user.id,
      message: parsed.data.message,
      message_type: "text",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("team_chat_reads").upsert(
    {
      organization_id: organization.id,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" },
  );

  await supabase.from("organization_activity_log").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    activity_type: "team_chat_message_sent",
    entity_type: "team_chat_message",
    entity_id: message.id,
    metadata: {
      message_preview: previewMessage(message.message),
      is_owner_sender: membership.role === "owner",
    },
  });

  const [decorated] = await decorateMessages(supabase, organization.id, user.id, [message]);
  return NextResponse.json({ message: decorated });
}

async function decorateMessages(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  currentUserId: string,
  messages: TeamChatMessage[],
) {
  const senderIds = [...new Set(messages.map((message) => message.sender_user_id))];
  const { data: profiles } = senderIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", senderIds)
    : { data: [] };
  const { data: memberships } = senderIds.length
    ? await supabase
        .from("organization_members")
        .select("user_id,role")
        .eq("organization_id", organizationId)
        .in("user_id", senderIds)
        .eq("status", "active")
    : { data: [] };

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const rolesById = new Map((memberships ?? []).map((membership) => [membership.user_id, membership.role]));

  return messages.map((message) => {
    const profile = profilesById.get(message.sender_user_id);
    const role = rolesById.get(message.sender_user_id) ?? "admin";
    return {
      id: message.id,
      organizationId: message.organization_id,
      senderUserId: message.sender_user_id,
      senderName: profile?.full_name ?? profile?.email ?? "Membro",
      senderRole: role,
      isOwnerSender: role === "owner",
      isMine: message.sender_user_id === currentUserId,
      message: message.message,
      messageType: message.message_type,
      createdAt: message.created_at,
    };
  });
}
