export const companyKnowledgeStatusLabels = {
  em_revisao: "Em revisao",
  em_desenvolvimento: "Em desenvolvimento",
  atualizado: "Atualizado",
  nao_iniciada: "Nao iniciada",
} as const;

export type CompanyKnowledgeStatus = keyof typeof companyKnowledgeStatusLabels;

export function isCompanyKnowledgeStatus(value: string | null | undefined): value is CompanyKnowledgeStatus {
  return Object.keys(companyKnowledgeStatusLabels).includes(value ?? "");
}

export function getCompanyKnowledgeStatusLabel(value: string | null | undefined) {
  return isCompanyKnowledgeStatus(value) ? companyKnowledgeStatusLabels[value] : "Nao iniciada";
}

export function slugifyCompanyKnowledge(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || crypto.randomUUID();
}

