export type TeamChatScope = "general" | "direct";

export const GENERAL_CONVERSATION_KEY = "general";

export function getDirectConversationKey(userA: string, userB: string) {
  return `direct:${[userA, userB].sort().join(":")}`;
}

export function getConversationKey({
  scope,
  currentUserId,
  recipientUserId,
}: {
  scope: TeamChatScope;
  currentUserId: string;
  recipientUserId?: string | null;
}) {
  return scope === "general" ? GENERAL_CONVERSATION_KEY : getDirectConversationKey(currentUserId, recipientUserId ?? "");
}

export function isValidDateKey(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function getSaoPauloDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getDateRangeForSaoPauloDay(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00-03:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

