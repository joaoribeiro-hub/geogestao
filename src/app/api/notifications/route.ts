import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { NOTIFICATION_ON_CONFLICT, syncDueReminderNotificationsForCurrentUser } from "@/lib/notifications/reminders";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) {
    return NextResponse.json({ notifications: [] });
  }

  await createDueServiceNotifications(supabase, context.organization.id, user.id);
  await syncDueReminderNotificationsForCurrentUser(supabase, {
    organizationId: context.organization.id,
    userId: user.id,
  });
  const nowIso = new Date().toISOString();
  const url = new URL(request.url);
  const includeRead = url.searchParams.get("includeRead") === "true";

  let query = supabase
    .from("notifications")
    .select("id,title,message,type,entity_type,entity_id,metadata,created_at,read_at,action_url")
    .eq("organization_id", context.organization.id)
    .eq("recipient_user_id", user.id)
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(includeRead ? 60 : 30);
  if (!includeRead) query = query.is("read_at", null);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ notifications: [], error: error.message }, { status: 500 });
  }

  const universal = await loadUniversalAnnouncements(supabase, user.id, nowIso, includeRead);
  const organizationNotifications = (data ?? []).map((item) => ({
    ...item,
    source: "organization" as const,
    group: classifyNotification(item),
  }));
  const notifications = [...organizationNotifications, ...universal]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, includeRead ? 60 : 30);

  return NextResponse.json({
    notifications,
  });
}

async function loadUniversalAnnouncements(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  nowIso: string,
  includeRead: boolean,
) {
  const database = supabase as unknown as UniversalNotificationDatabase;
  const announcements = await database
    .from("universal_announcements")
    .select("id,title,body,attachment_file_name,created_at,starts_at")
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (announcements.error || !announcements.data?.length) return [];
  const ids = announcements.data.map((item) => item.id);
  const reads = await database
    .from("universal_announcement_reads")
    .select("announcement_id,read_at")
    .eq("user_id", userId)
    .in("announcement_id", ids);
  const readMap = new Map((reads.data ?? []).map((read) => [read.announcement_id, read.read_at]));
  return announcements.data
    .map((item) => ({
      id: `universal:${item.id}`,
      title: item.title,
      message: item.body,
      type: "universal_announcement",
      entity_type: "universal_announcement",
      entity_id: item.id,
      metadata: { category: "notas", universal: true },
      created_at: item.created_at,
      read_at: readMap.get(item.id) ?? null,
      action_url: null,
      group: "notes" as const,
      source: "universal" as const,
      attachment_file_name: item.attachment_file_name,
    }))
    .filter((item) => includeRead || !item.read_at);
}

function classifyNotification(notification: {
  type: string;
  entity_type: string | null;
  metadata: unknown;
}) {
  const metadata =
    notification.metadata && typeof notification.metadata === "object"
      ? (notification.metadata as Record<string, unknown>)
      : {};
  const category = String(metadata.category ?? "").toLowerCase();
  const type = notification.type.toLowerCase();
  const entity = (notification.entity_type ?? "").toLowerCase();
  if (
    type.includes("member_added") ||
    type.includes("responsible") ||
    type.includes("assigned") ||
    type.includes("mention")
  ) {
    return "mentions";
  }
  if (
    category === "projetos" ||
    entity.includes("service") ||
    entity.includes("client") ||
    type.includes("service") ||
    type.includes("project")
  ) {
    return "projects";
  }
  return "notes";
}

async function createDueServiceNotifications(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  userId: string,
) {
  const today = new Date();
  const offsets = [5, 2, 1];
  const dates = offsets.map((offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  });

  const { data: cards } = await supabase
    .from("service_cards")
    .select("id,title,due_date,responsible_user_id")
    .eq("organization_id", organizationId)
    .in("due_date", dates);
  if (!cards?.length) return;

  const { data: ownerRows } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("role", "owner");
  const owners = ownerRows?.map((row) => row.user_id).filter(Boolean) ?? [];

  const notifications = cards.flatMap((card) => {
    if (!card.due_date) return [];
    const days = Math.max(
      0,
      Math.round((new Date(`${card.due_date}T00:00:00`).getTime() - new Date(today.toISOString().slice(0, 10)).getTime()) / 86400000),
    );
    const recipients = Array.from(new Set([...owners, card.responsible_user_id, userId].filter(Boolean))) as string[];
    return recipients.map((recipientId) => ({
      organization_id: organizationId,
      recipient_user_id: recipientId,
      type: "service_due",
      title: "Prazo de servico",
      message: `Servico ${card.title} vence em ${days} dia(s). Data final: ${card.due_date}.`,
      entity_type: "service_card",
      entity_id: card.id,
      action_url: `/servicos/${card.id}`,
      metadata: { service_card_id: card.id, days },
      scheduled_for: new Date().toISOString(),
      dedupe_key: `service-due:${card.id}:${days}:${recipientId}`,
    }));
  });

  if (notifications.length) {
    await supabase.from("notifications").upsert(notifications, { onConflict: NOTIFICATION_ON_CONFLICT });
  }
}

type UniversalAnnouncementRow = { id: string; title: string; body: string; attachment_file_name: string | null; created_at: string; starts_at: string };
type UniversalReadRow = { announcement_id: string; read_at: string };
type UniversalAnnouncementQuery = PromiseLike<{ data: UniversalAnnouncementRow[] | null; error: { message: string } | null }> & {
  eq(column: string, value: string | boolean): UniversalAnnouncementQuery;
  lte(column: string, value: string): UniversalAnnouncementQuery;
  or(filter: string): UniversalAnnouncementQuery;
  order(column: string, options: { ascending: boolean }): UniversalAnnouncementQuery;
  limit(value: number): UniversalAnnouncementQuery;
};
type UniversalReadQuery = PromiseLike<{ data: UniversalReadRow[] | null; error: { message: string } | null }> & {
  eq(column: string, value: string): UniversalReadQuery;
  in(column: string, values: string[]): UniversalReadQuery;
};
type UniversalNotificationDatabase = {
  from(table: "universal_announcements"): { select(columns: string): UniversalAnnouncementQuery };
  from(table: "universal_announcement_reads"): { select(columns: string): UniversalReadQuery };
};
