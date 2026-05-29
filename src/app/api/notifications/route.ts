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

  return NextResponse.json({
    notifications: (data ?? []).map((item) => ({
      ...item,
      group: classifyNotification(item),
    })),
  });
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
