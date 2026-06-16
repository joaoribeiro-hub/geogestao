"use client";

import { AssistantFloatingWidget } from "@/components/assistant/assistant-floating-widget";
import { AppearanceWidget } from "@/components/appearance/appearance-widget";
import { DailyChecklistWidget } from "@/components/checklist/daily-checklist-widget";
import { useFloatingBadgeCounts } from "@/components/floating/use-floating-badge-counts";
import { TeamChatWidget } from "@/components/team-chat/team-chat-widget";

export function FloatingWidgets() {
  const { counts, refreshCounts } = useFloatingBadgeCounts();

  return (
    <div className="floating-actions-container">
      <AppearanceWidget />
      <DailyChecklistWidget counts={counts.checklist} onCountsChanged={refreshCounts} />
      <TeamChatWidget
        organizationId={counts.organizationId}
        counts={counts.chat}
        onCountsChanged={refreshCounts}
      />
      <AssistantFloatingWidget />
    </div>
  );
}
