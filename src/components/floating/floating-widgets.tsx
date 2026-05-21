"use client";

import { AssistantFloatingWidget } from "@/components/assistant/assistant-floating-widget";
import { DailyChecklistWidget } from "@/components/checklist/daily-checklist-widget";
import { useFloatingBadgeCounts } from "@/components/floating/use-floating-badge-counts";
import { TeamChatWidget } from "@/components/team-chat/team-chat-widget";

export function FloatingWidgets() {
  const { counts, refreshCounts } = useFloatingBadgeCounts();

  return (
    <>
      <TeamChatWidget
        organizationId={counts.organizationId}
        counts={counts.chat}
        onCountsChanged={refreshCounts}
      />
      <DailyChecklistWidget counts={counts.checklist} onCountsChanged={refreshCounts} />
      <AssistantFloatingWidget />
    </>
  );
}
