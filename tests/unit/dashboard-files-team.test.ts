import { describe, expect, it } from "vitest";
import { filterOrganizationRows } from "@/lib/services/dashboard-metrics";
import {
  assertSafeOrganizationStoragePath,
  getOrganizationEntityFolder,
  isOrganizationStoragePath,
} from "@/lib/services/organization-files";
import {
  buildTeamMemberExpenseDescription,
  shouldCreateTeamMemberMonthlyExpense,
} from "@/lib/services/team-finance";

describe("dashboard organization scope", () => {
  it("ignores rows from other organizations and rows without organization_id", () => {
    const rows = [
      { id: "client-1", organization_id: "org-1" },
      { id: "client-2", organization_id: "org-2" },
      { id: "seed-client", organization_id: null },
    ];

    expect(filterOrganizationRows(rows, "org-1")).toEqual([
      { id: "client-1", organization_id: "org-1" },
    ]);
  });
});

describe("organization storage helpers", () => {
  it("builds entity folders with organization-safe prefixes handled elsewhere", () => {
    expect(getOrganizationEntityFolder("client", "client-1")).toBe("clients/client-1");
    expect(getOrganizationEntityFolder("service_card", "service-1")).toBe("services/service-1");
    expect(getOrganizationEntityFolder("document_template")).toBe("documents");
  });

  it("rejects deletion outside the current organization path", () => {
    expect(isOrganizationStoragePath("org-1", "organizations/org-1/clients/file.pdf")).toBe(true);
    expect(isOrganizationStoragePath("org-1", "organizations/org-2/clients/file.pdf")).toBe(false);
    expect(() =>
      assertSafeOrganizationStoragePath("org-1", "organizations/org-2/clients/file.pdf"),
    ).toThrow("Caminho de arquivo fora da organizacao atual.");
  });
});

describe("team member finance", () => {
  it("prepares a monthly expense only when there is a positive amount", () => {
    expect(shouldCreateTeamMemberMonthlyExpense(0)).toBe(false);
    expect(shouldCreateTeamMemberMonthlyExpense(null)).toBe(false);
    expect(shouldCreateTeamMemberMonthlyExpense(2500)).toBe(true);
    expect(buildTeamMemberExpenseDescription("Natalia")).toBe("Pagamento mensal - Natalia");
  });
});
