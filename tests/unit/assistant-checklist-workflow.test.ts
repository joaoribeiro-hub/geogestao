import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AI-ASSISTANT-ACTIONS-CHECKLIST-1", () => {
  it("cria migration para feedback, checklist diario e activity log com RLS", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/027_assistant_checklist_feedback.sql"),
      "utf8",
    );

    expect(migration).toContain("assistant_feedback");
    expect(migration).toContain("daily_checklists");
    expect(migration).toContain("daily_checklist_items");
    expect(migration).toContain("organization_activity_log");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("public.is_org_member");
    expect(migration).toContain("public.is_org_owner");
    expect(migration).toContain("create_service");
    expect(migration).toContain("assign_checklist_item");
  });

  it("remove Assistente IA do menu lateral e mantem botoes flutuantes", () => {
    const appShell = readFileSync(
      join(process.cwd(), "src/components/layout/app-shell.tsx"),
      "utf8",
    );

    expect(appShell).not.toContain('href: "/assistente-ia"');
    expect(appShell).toContain("FloatingWidgets");
  });
});
