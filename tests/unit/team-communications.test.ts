import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateChecklistBadgeCounts,
  calculateTeamChatBadgeCounts,
  previewMessage,
} from "@/lib/team-communications/badges";

describe("TEAM-COMMS-CHECKLIST-BADGES-1", () => {
  it("conta apenas itens abertos de hoje no badge do checklist", () => {
    const counts = calculateChecklistBadgeCounts({
      currentUserId: "admin-1",
      date: "2026-05-21",
      ownerUserIds: new Set(["owner-1"]),
      items: [
        { status: "open", source: "self", created_by: "admin-1" },
        { status: "done", source: "owner_assignment", created_by: "owner-1" },
        { status: "canceled", source: "self", created_by: "admin-1" },
      ],
    });

    expect(counts).toMatchObject({
      openCount: 1,
      ownerAssignedOpenCount: 0,
      emergencyOpenCount: 0,
      date: "2026-05-21",
    });
  });

  it("destaca no badge vermelho itens abertos atribuidos pelo owner", () => {
    const counts = calculateChecklistBadgeCounts({
      currentUserId: "admin-1",
      date: "2026-05-21",
      ownerUserIds: new Set(["owner-1"]),
      items: [
        { status: "open", source: "owner_assignment", created_by: "owner-1" },
        { status: "open", source: "assistant", created_by: "owner-1", is_emergency: true },
        { status: "open", source: "self", created_by: "admin-1" },
      ],
    });

    expect(counts.openCount).toBe(3);
    expect(counts.ownerAssignedOpenCount).toBe(2);
    expect(counts.emergencyOpenCount).toBe(1);
  });

  it("separa mensagens nao lidas de owner e de membros", () => {
    const counts = calculateTeamChatBadgeCounts({
      currentUserId: "admin-1",
      ownerUserIds: new Set(["owner-1"]),
      messages: [
        { sender_user_id: "admin-1", created_at: "2026-05-21T09:00:00.000Z" },
        { sender_user_id: "owner-1", created_at: "2026-05-21T09:01:00.000Z" },
        { sender_user_id: "admin-2", created_at: "2026-05-21T09:02:00.000Z" },
      ],
    });

    expect(counts).toEqual({
      unreadCount: 2,
      ownerUnreadCount: 1,
      memberUnreadCount: 1,
    });
  });

  it("cria migration de chat da equipe com RLS, leitura e realtime", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/029_team_comms_checklist_badges.sql"),
      "utf8",
    );

    expect(migration).toContain("team_chat_messages");
    expect(migration).toContain("team_chat_reads");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("public.is_org_member");
    expect(migration).toContain("public.is_org_owner");
    expect(migration).toContain("supabase_realtime");
  });

  it("integra chat, checklist e assistente nos widgets flutuantes", () => {
    const wrapper = readFileSync(
      join(process.cwd(), "src/components/floating/floating-widgets.tsx"),
      "utf8",
    );
    const chatWidget = readFileSync(
      join(process.cwd(), "src/components/team-chat/team-chat-widget.tsx"),
      "utf8",
    );
    const checklistWidget = readFileSync(
      join(process.cwd(), "src/components/checklist/daily-checklist-widget.tsx"),
      "utf8",
    );

    expect(wrapper).toContain("TeamChatWidget");
    expect(wrapper).toContain("DailyChecklistWidget");
    expect(wrapper).toContain("AssistantFloatingWidget");
    expect(chatWidget).toContain("team-chat-owner-badge");
    expect(chatWidget).toContain("team-chat-unread-badge");
    expect(checklistWidget).toContain("daily-checklist-owner-badge");
    expect(checklistWidget).toContain("daily-checklist-open-badge");
  });

  it("limita preview de activity log do chat", () => {
    expect(previewMessage("a".repeat(120))).toHaveLength(80);
  });
});
