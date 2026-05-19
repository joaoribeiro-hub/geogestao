import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("organization_members RLS correction", () => {
  it("usa funcoes SECURITY DEFINER e remove policies recursivas", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/017_org_members_rls_service_lost_finance.sql"),
      "utf8",
    );

    expect(migration).toContain("security definer");
    expect(migration).toContain("public.is_org_member");
    expect(migration).toContain("public.is_org_owner_or_admin");
    expect(migration).toContain('drop policy if exists "organization_members_crud_owner_admin"');
    expect(migration).toContain('create policy "organization_members_select_safe"');
    expect(migration).not.toContain("current_member.organization_id = organization_members.organization_id");
  });
});
