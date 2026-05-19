import { describe, expect, it } from "vitest";
import {
  buildOrganizationStoragePath,
  canManageOrganization,
  canViewOrganizationSettings,
} from "@/lib/organization";
import {
  buildTeamMemberExpenseDescription,
  shouldCreateTeamMemberMonthlyExpense,
} from "@/lib/services/team-finance";

describe("organization service helpers", () => {
  it("permite edicao da empresa apenas para owner", () => {
    expect(
      canManageOrganization({
        profile: { role: "leitura" },
        membership: { role: "owner", status: "active" },
      }),
    ).toBe(true);
    expect(
      canManageOrganization({
        profile: { role: "leitura" },
        membership: { role: "admin", status: "active" },
      }),
    ).toBe(false);
    expect(
      canManageOrganization({
        profile: { role: "admin" },
        membership: null,
      }),
    ).toBe(false);
  });

  it("permite visualizacao de Minha Empresa para owner/admin ativos", () => {
    expect(canViewOrganizationSettings({ membership: { role: "owner", status: "active" } })).toBe(true);
    expect(canViewOrganizationSettings({ membership: { role: "admin", status: "active" } })).toBe(true);
    expect(canViewOrganizationSettings({ membership: { role: "tecnico", status: "active" } })).toBe(false);
    expect(canViewOrganizationSettings({ membership: { role: "admin", status: "suspended" } })).toBe(false);
  });

  it("monta path de storage isolado por organizacao", () => {
    const path = buildOrganizationStoragePath({
      organizationId: "org-123",
      folder: "/services/service-1/",
      fileName: "matricula atualizada.pdf",
    });

    expect(path).toMatch(/^organizations\/org-123\/services\/service-1\//);
    expect(path).toContain("matricula-atualizada.pdf");
  });

  it("prepara despesa mensal apenas quando existe valor positivo", () => {
    expect(shouldCreateTeamMemberMonthlyExpense(1200)).toBe(true);
    expect(shouldCreateTeamMemberMonthlyExpense(0)).toBe(false);
    expect(shouldCreateTeamMemberMonthlyExpense(null)).toBe(false);
    expect(buildTeamMemberExpenseDescription("Ana Silva")).toBe("Pagamento mensal - Ana Silva");
  });
});
