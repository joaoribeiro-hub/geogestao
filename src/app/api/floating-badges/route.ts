import { NextResponse } from "next/server";
import { calculateChecklistBadgeCounts, calculateTeamChatBadgeCounts } from "@/lib/team-communications/badges";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }
  const today = new Date().toISOString().slice(0, 10);

  const ownerUserIds = await getOrganizationOwnerIds(supabase, organization.id);

  const { data: checklistItems, error: checklistError } = await supabase
    .from("daily_checklist_items")
    .select("status,source,created_by,is_emergency")
    .eq("organization_id", organization.id)
    .eq("assigned_to", user.id)
    .eq("status", "open")
    .is("deleted_at", null)
    .is("archived_at", null)
    .or(`due_date.lte.${today},due_date.is.null`);
  if (checklistError) return NextResponse.json({ error: checklistError.message }, { status: 500 });

  const { data: reads, error: readError } = await supabase
    .from("team_chat_reads")
    .select("conversation_key,last_read_at")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id);
  if (readError && !/team_chat_reads/i.test(readError.message)) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const readsByConversation = new Map(
    (reads ?? []).map((read) => [read.conversation_key, read.last_read_at ?? membership.created_at]),
  );
  const { data: candidateMessages, error: messagesError } = await supabase
    .from("team_chat_messages")
    .select("sender_user_id,created_at,chat_scope,recipient_user_id,conversation_key")
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .neq("sender_user_id", user.id)
    .or(`chat_scope.eq.general,recipient_user_id.eq.${user.id}`);
  if (messagesError && !/team_chat_messages/i.test(messagesError.message)) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const unreadMessages = (candidateMessages ?? []).filter((message) => {
    const conversationKey = message.conversation_key ?? "general";
    const since = readsByConversation.get(conversationKey) ?? membership.created_at;
    return message.created_at > since;
  });

  const checklistCounts = calculateChecklistBadgeCounts({
    items: checklistItems ?? [],
    ownerUserIds,
    currentUserId: user.id,
    date: today,
  });
  const chatCounts = calculateTeamChatBadgeCounts({
    messages: unreadMessages,
    ownerUserIds,
    currentUserId: user.id,
  });

  return NextResponse.json({
    organizationId: organization.id,
    checklist: checklistCounts,
    chat: chatCounts,
  });
}

async function getOrganizationOwnerIds(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((member) => member.user_id));
}
