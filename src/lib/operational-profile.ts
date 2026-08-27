export const OPERATIONAL_PROFILES = ["padrao", "agrimensura", "arquitetura"] as const;

export type OperationalProfile = (typeof OPERATIONAL_PROFILES)[number];

export const operationalProfileLabels: Record<OperationalProfile, string> = {
  padrao: "Padrão",
  agrimensura: "Agrimensura",
  arquitetura: "Arquitetura",
};

export const defaultServiceBoardSlugs = [
  "georreferenciamento",
  "car",
  "itr-ccir",
  "outros-servicos",
] as const;

export function normalizeOperationalProfile(value: unknown): OperationalProfile {
  return OPERATIONAL_PROFILES.includes(value as OperationalProfile)
    ? (value as OperationalProfile)
    : "agrimensura";
}

export function isUniversalTool(slug: string) {
  return slug === "portal-cliente";
}

export function isToolVisibleForProfile(slug: string, profile: OperationalProfile) {
  return profile === "agrimensura" || isUniversalTool(slug);
}

export function isBoardVisibleForProfile(
  board: { slug: string; organization_id?: string | null; operational_profile?: string | null; is_active?: boolean | null },
  profile: OperationalProfile,
  organizationId: string,
) {
  if (board.is_active === false) return false;
  if (board.organization_id && board.organization_id !== organizationId) return false;
  if (board.organization_id) return normalizeOperationalProfile(board.operational_profile) === profile;
  return profile === "agrimensura" && defaultServiceBoardSlugs.includes(board.slug as (typeof defaultServiceBoardSlugs)[number]);
}

export function slugifyOperationalName(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tipo-servico";
}
