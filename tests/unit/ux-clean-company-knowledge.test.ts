import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  companyKnowledgeCategorySchema,
  companyKnowledgeItemSchema,
} from "@/lib/schemas";
import {
  getCompanyKnowledgeStatusLabel,
  slugifyCompanyKnowledge,
} from "@/lib/company-knowledge";

describe("UX-CLEAN-COMPANY-KNOWLEDGE-1", () => {
  it("normalizes company knowledge slugs and status labels", () => {
    expect(slugifyCompanyKnowledge("Política de Vestimenta")).toBe("politica-de-vestimenta");
    expect(slugifyCompanyKnowledge("[Semanal] Reunião 1:1")).toBe("semanal-reuniao-1-1");
    expect(getCompanyKnowledgeStatusLabel("em_desenvolvimento")).toBe("Em desenvolvimento");
    expect(getCompanyKnowledgeStatusLabel("nao_iniciada")).toBe("Nao iniciada");
  });

  it("validates the clean knowledge category and page schemas", () => {
    expect(companyKnowledgeCategorySchema.parse({ name: "Procedimentos Gerais" }).name).toBe(
      "Procedimentos Gerais",
    );

    const parsed = companyKnowledgeItemSchema.parse({
      category_id: "00000000-0000-4000-8000-000000000001",
      title: "Codigo de Conduta",
      status: "em_revisao",
      description: "Pagina base",
      content_markdown: "- Regra 1",
    });

    expect(parsed.status).toBe("em_revisao");
    expect(parsed.content_markdown).toContain("Regra");
  });

  it("keeps the default knowledge seed idempotent and organization scoped", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/036_ux_clean_company_knowledge.sql"),
      "utf8",
    );

    expect(sql).toContain("insert into public.company_knowledge_categories");
    expect(sql).toContain("from public.organizations o");
    expect(sql).toContain("seed_company_knowledge_defaults");
    expect(sql).toContain("organizations_seed_company_knowledge_defaults");
    expect(sql).toContain("where not exists");
    expect(sql).toContain("existing.slug = d.slug");
    expect(sql).toContain("existing.slug = p.page_slug");
    expect(sql).toContain("Regras e Diretrizes");
    expect(sql).toContain("Procedimentos Gerais");
    expect(sql).toContain("Politica de Vestimenta");
    expect(sql).toContain("Como Solicitar Material");
  });
});
