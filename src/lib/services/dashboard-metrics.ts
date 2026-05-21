export type OrganizationScopedRow = {
  organization_id: string | null;
};

export function filterOrganizationRows<T extends OrganizationScopedRow>(
  rows: T[],
  organizationId: string,
) {
  return rows.filter((row) => row.organization_id === organizationId);
}

export function countOrganizationRows<T extends OrganizationScopedRow>(
  rows: T[],
  organizationId: string,
) {
  return filterOrganizationRows(rows, organizationId).length;
}
