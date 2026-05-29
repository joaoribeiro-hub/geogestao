import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { previewMessage } from "@/lib/team-communications/badges";
import {
  GENERAL_CONVERSATION_KEY,
  getConversationKey,
  getDateRangeForSaoPauloDay,
  getSaoPauloDateKey,
  isValidDateKey,
} from "@/lib/team-communications/conversations";
import type { TeamChatMessage } from "@/types/database";

const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  scope: z.enum(["general", "direct"]).default("general"),
  recipientUserId: z.string().uuid().optional().nullable(),
});

const listMessagesSchema = z.object({
  scope: z.enum(["general", "direct"]).default("general"),
  recipientUserId: z.string().uuid().optional().nullable(),
  date: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = listMessagesSchema.safeParse({
    scope: searchParams.get("scope") ?? "general",
    recipientUserId: searchParams.get("recipientUserId"),
    date: searchParams.get("date") ?? getSaoPauloDateKey(),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtro do chat invalido." }, { status: 400 });
  }

  const members = await listOrganizationMembers(supabase, organization.id);
  const dateKey = isValidDateKey(parsed.data.date) ? parsed.data.date! : getSaoPauloDateKey();
  const { startIso, endIso } = getDateRangeForSaoPauloDay(dateKey);
  const scope = parsed.data.scope;
  const recipientUserId = scope === "direct" ? parsed.data.recipientUserId : null;

  if (scope === "direct" && !members.some((member) => member.id === recipientUserId)) {
    return NextResponse.json({ error: "Membro da conversa direta nao encontrado." }, { status: 404 });
  }

  const conversationKey = getConversationKey({
    scope,
    currentUserId: user.id,
    recipientUserId,
  });

  let query = supabase
    .from("team_chat_messages")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("conversation_key", conversationKey)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  query = scope === "general" ? query.eq("chat_scope", "general") : query.eq("chat_scope", "direct");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const decoratedMessages = await decorateMessages(supabase, organization.id, user.id, data ?? []);

  return NextResponse.json({
    organizationId: organization.id,
    conversationKey,
    scope,
    date: dateKey,
    members: members.filter((member) => member.id !== user.id),
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

  const scope = parsed.data.scope;
  const recipientUserId = scope === "direct" ? parsed.data.recipientUserId : null;
  if (scope === "direct") {
    if (!recipientUserId || recipientUserId === user.id) {
      return NextResponse.json({ error: "Escolha um membro valido para a conversa direta." }, { status: 400 });
    }
    const member = await findOrganizationMember(supabase, organization.id, recipientUserId);
    if (!member) {
      return NextResponse.json({ error: "Membro da conversa direta nao encontrado." }, { status: 404 });
    }
  }

  const conversationKey = getConversationKey({
    scope,
    currentUserId: user.id,
    recipientUserId,
  });

  const { data: message, error } = await supabase
    .from("team_chat_messages")
    .insert({
      organization_id: organization.id,
      sender_user_id: user.id,
      message: parsed.data.message,
      message_type: "text",
      chat_scope: scope,
      recipient_user_id: recipientUserId,
      conversation_key: conversationKey,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("team_chat_reads").upsert(
    {
      organization_id: organization.id,
      user_id: user.id,
      conversation_key: conversationKey,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id,conversation_key" },
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
      chat_scope: scope,
      conversation_key: conversationKey,
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
      chatScope: message.chat_scope,
      recipientUserId: message.recipient_user_id,
      conversationKey: message.conversation_key ?? GENERAL_CONVERSATION_KEY,
      createdAt: message.created_at,
    };
  });
}

async function listOrganizationMembers(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
) {
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("user_id,role")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const userIds = (memberships ?? []).map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (memberships ?? []).map((member) => {
    const profile = profilesById.get(member.user_id);
    return {
      id: member.user_id,
      name: profile?.full_name ?? profile?.email ?? "Membro",
      role: member.role,
    };
  });
}

async function findOrganizationMember(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
