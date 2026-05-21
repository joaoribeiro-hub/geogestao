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

  const { data: checklist } = await supabase
    .from("daily_checklists")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("checklist_date", today)
    .maybeSingle();

  const { data: checklistItems, error: checklistError } = checklist?.id
    ? await supabase
        .from("daily_checklist_items")
        .select("status,source,created_by,is_emergency")
        .eq("organization_id", organization.id)
        .eq("assigned_to", user.id)
        .eq("checklist_id", checklist.id)
        .neq("status", "canceled")
    : { data: [], error: null };
  if (checklistError) return NextResponse.json({ error: checklistError.message }, { status: 500 });

  const { data: read, error: readError } = await supabase
    .from("team_chat_reads")
    .select("last_read_at")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError && !/team_chat_reads/i.test(readError.message)) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const since = read?.last_read_at ?? membership.created_at;
  const { data: unreadMessages, error: messagesError } = await supabase
    .from("team_chat_messages")
    .select("sender_user_id,created_at")
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .gt("created_at", since);
  if (messagesError && !/team_chat_messages/i.test(messagesError.message)) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const checklistCounts = calculateChecklistBadgeCounts({
    items: checklistItems ?? [],
    ownerUserIds,
    currentUserId: user.id,
    date: today,
  });
  const chatCounts = calculateTeamChatBadgeCounts({
    messages: unreadMessages ?? [],
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
