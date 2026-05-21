type ChecklistStatusItem = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type ActivityLogItem = {
  activity_type: string;
  metadata: unknown;
  occurred_at: string;
};

export function getMemberCurrentWorkStatusFromItems<TItem extends ChecklistStatusItem, TActivity extends ActivityLogItem>(
  items: TItem[],
  activities: TActivity[] = [],
) {
  const orderedItems = [...items].sort(compareChecklistItems);
  const completedItems = orderedItems.filter((item) => item.status === "done");
  const openItems = orderedItems.filter((item) => item.status === "open");
  const lastCompleted = [...completedItems].sort(compareCompletedItems).at(-1) ?? null;
  const currentItem =
    (lastCompleted
      ? openItems.find((item) => compareChecklistItems(item, lastCompleted) > 0)
      : openItems[0]) ?? openItems[0] ?? null;
  const lastActivity = [...activities].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0] ?? null;

  return {
    completedItems,
    openItems,
    currentItem,
    lastActivity,
    activitiesCount: activities.length,
  };
}

export function formatMemberCurrentWorkMessage({
  memberName,
  dateLabel,
  completedTitles,
  currentTitle,
  lastActivityText,
}: {
  memberName: string;
  dateLabel: string;
  completedTitles: string[];
  currentTitle: string | null;
  lastActivityText?: string | null;
}) {
  const completedBlock = completedTitles.length
    ? `${memberName} concluiu:\n${completedTitles.map((title) => `- ${title}`).join("\n")}`
    : `${memberName} ainda nao concluiu itens em ${dateLabel}.`;
  const currentBlock = currentTitle
    ? `Agora ele provavelmente esta fazendo:\n- ${currentTitle}`
    : "Nao ha item aberto em andamento agora.";
  const basis = currentTitle
    ? `Baseei isso no checklist de ${dateLabel}: o ultimo item concluido e o proximo item aberto ajudam a indicar o item atual.`
    : `Baseei isso no checklist de ${dateLabel}.`;

  return [completedBlock, currentBlock, basis, lastActivityText ? `Ultima atividade registrada: ${lastActivityText}.` : null]
    .filter(Boolean)
    .join("\n\n");
}

function compareChecklistItems(left: ChecklistStatusItem, right: ChecklistStatusItem) {
  return Date.parse(left.created_at) - Date.parse(right.created_at);
}

function compareCompletedItems(left: ChecklistStatusItem, right: ChecklistStatusItem) {
  const leftTime = Date.parse(left.completed_at ?? left.created_at);
  const rightTime = Date.parse(right.completed_at ?? right.created_at);
  return leftTime - rightTime;
}
