export type ChecklistBadgeItem = {
  status: string;
  source: string | null;
  created_by: string;
  is_emergency?: boolean | null;
};

export type TeamChatBadgeMessage = {
  sender_user_id: string;
  created_at: string;
};

export function calculateChecklistBadgeCounts({
  items,
  ownerUserIds,
  currentUserId,
  date,
}: {
  items: ChecklistBadgeItem[];
  ownerUserIds: Set<string>;
  currentUserId: string;
  date: string;
}) {
  const openItems = items.filter((item) => item.status === "open");
  return {
    openCount: openItems.length,
    ownerAssignedOpenCount: openItems.filter((item) =>
      item.source === "owner_assignment" ||
      (ownerUserIds.has(item.created_by) && item.created_by !== currentUserId)
    ).length,
    emergencyOpenCount: openItems.filter((item) => Boolean(item.is_emergency)).length,
    date,
  };
}

export function calculateTeamChatBadgeCounts({
  messages,
  ownerUserIds,
  currentUserId,
}: {
  messages: TeamChatBadgeMessage[];
  ownerUserIds: Set<string>;
  currentUserId: string;
}) {
  const unread = messages.filter((message) => message.sender_user_id !== currentUserId);
  const ownerUnreadCount = unread.filter((message) => ownerUserIds.has(message.sender_user_id)).length;
  const memberUnreadCount = unread.length - ownerUnreadCount;
  return {
    unreadCount: unread.length,
    ownerUnreadCount,
    memberUnreadCount,
  };
}

export function previewMessage(message: string, limit = 80) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, Math.max(0, limit - 3))}...` : clean;
}
