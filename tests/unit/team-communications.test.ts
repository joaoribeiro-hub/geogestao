import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateChecklistBadgeCounts,
  calculateTeamChatBadgeCounts,
  previewMessage,
} from "@/lib/team-communications/badges";
import {
  getDateRangeForSaoPauloDay,
  getDirectConversationKey,
  GENERAL_CONVERSATION_KEY,
} from "@/lib/team-communications/conversations";

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

  it("gera chave estavel para conversa direta", () => {
    expect(getDirectConversationKey("user-b", "user-a")).toBe("direct:user-a:user-b");
    expect(getDirectConversationKey("user-a", "user-b")).toBe("direct:user-a:user-b");
    expect(GENERAL_CONVERSATION_KEY).toBe("general");
  });

  it("filtra mensagens por dia no timezone do Brasil", () => {
    expect(getDateRangeForSaoPauloDay("2026-05-21")).toEqual({
      startIso: "2026-05-21T03:00:00.000Z",
      endIso: "2026-05-22T03:00:00.000Z",
    });
  });

  it("cria migration de refinamento com chat direto e leitura por conversa", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/031_notifications_chat_direct_refine.sql"),
      "utf8",
    );

    expect(migration).toContain("action_url text");
    expect(migration).toContain("chat_scope text");
    expect(migration).toContain("recipient_user_id uuid");
    expect(migration).toContain("conversation_key text");
    expect(migration).toContain("unique (organization_id, user_id, conversation_key)");
    expect(migration).toContain("chat_scope = 'general'");
    expect(migration).toContain("recipient_user_id = auth.uid()");
  });

  it("exibe controles de conversa direta e filtro de data no widget", () => {
    const widget = readFileSync(
      join(process.cwd(), "src/components/team-chat/team-chat-widget.tsx"),
      "utf8",
    );

    expect(widget).toContain("Geral da empresa");
    expect(widget).toContain("Direto:");
    expect(widget).toContain('data-testid={`team-chat-date-${filter}`}');
    expect(widget).toContain('"today", "yesterday", "custom"');
  });
});
