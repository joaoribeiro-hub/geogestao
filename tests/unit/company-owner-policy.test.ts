import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("company owner-only policies", () => {
  it("separa owner de admin operacional nas permissoes de Minha Empresa", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/018_company_owner_only_permissions.sql"),
      "utf8",
    );

    expect(migration).toContain("public.is_org_owner");
    expect(migration).toContain("role = 'owner'");
    expect(migration).toContain("company_settings_update_owner");
    expect(migration).toContain("team_members_insert_owner");
    expect(migration).toContain("company_services_update_owner");
    expect(migration).toContain("nataliasilva.terras@gmail.com");
    expect(migration).toContain("romeu@teste.com.br");
    expect(migration).not.toContain("'member'");
  });
});
