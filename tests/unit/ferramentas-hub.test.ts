import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canUseTool,
  GEOGESTAO_TOOLS,
  getMoreTools,
  getMyTools,
  getToolBySlug,
} from "@/lib/tools/tool-access";

describe("Ferramentas hub", () => {
  it("lista as ferramentas liberadas para teste", () => {
    expect(GEOGESTAO_TOOLS.map((tool) => tool.slug)).toEqual([
      "meu-imovel-car",
      "buscageo",
      "corretor-rtk-ppp",
      "gerador-rw5",
      "portal-cliente",
      "desenhar-geo",
      "analise-ambiental",
    ]);

    expect(getMyTools()).toHaveLength(7);
    expect(getMoreTools()).toHaveLength(0);
    expect(canUseTool("portal-cliente")).toBe(true);
    expect(canUseTool("desenhar-geo")).toBe(true);
    expect(canUseTool("analise-ambiental")).toBe(true);
  });

  it("aponta Abrir para rotas antigas ou novas corretas", () => {
    expect(getToolBySlug("meu-imovel-car")?.routePath).toBe("/modulos/meu-imovel-car");
    expect(getToolBySlug("buscageo")?.routePath).toBe("/modulos/buscageo");
    expect(getToolBySlug("corretor-rtk-ppp")?.routePath).toBe("/modulos/corretor-rtk-ppp");
    expect(getToolBySlug("gerador-rw5")?.routePath).toBe("/modulos/gerador-rw5");
    expect(getToolBySlug("portal-cliente")?.routePath).toBe("/ferramentas/portal-cliente");
    expect(getToolBySlug("desenhar-geo")?.routePath).toBe("/ferramentas/desenhar-geo");
    expect(getToolBySlug("analise-ambiental")?.routePath).toBe("/ferramentas/analise-ambiental");
  });

  it("cria pagina /ferramentas com Minhas ferramentas e Mais ferramentas", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/ferramentas/page.tsx"), "utf8");
    const hub = readFileSync(join(process.cwd(), "src/components/tools/tools-hub.tsx"), "utf8");

    expect(page).toContain("Ferramentas");
    expect(page).toContain("ToolsHub");
    expect(hub).toContain("Minhas ferramentas");
    expect(hub).toContain("Mais ferramentas");
    expect(hub).toContain("Todas as ferramentas estão liberadas");
    expect(hub).toContain("Abrir");
    expect(hub).toContain("Detalhes");
  });

  it("menu lateral mostra Ferramentas abaixo de Inicio", () => {
    const appShell = readFileSync(join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8");

    expect(appShell.indexOf('href: "/inicio"')).toBeLessThan(appShell.indexOf('href: "/ferramentas"'));
    expect(appShell.indexOf('href: "/ferramentas"')).toBeLessThan(appShell.indexOf('href: "/servicos"'));
    expect(appShell).toContain("Agrimensura / Arquitetura / Engenharia");
    expect(appShell).not.toContain("ModuleSwitcher");
  });

  it("rotas iniciais das novas ferramentas nao ficam genericas", () => {
    const portal = readFileSync(join(process.cwd(), "src/app/(app)/ferramentas/portal-cliente/page.tsx"), "utf8");
    const desenhar = readFileSync(join(process.cwd(), "src/app/(app)/ferramentas/desenhar-geo/page.tsx"), "utf8");
    const desenharWorkspace = readFileSync(
      join(process.cwd(), "src/components/tools/desenhar-geo/desenhar-geo-workspace.tsx"),
      "utf8",
    );
    const ambiental = readFileSync(join(process.cwd(), "src/app/(app)/ferramentas/analise-ambiental/page.tsx"), "utf8");

    expect(portal).toContain("Acompanhamento limpo para o cliente");
    expect(portal).toContain("Abrir serviços");
    expect(desenhar).toContain("KML segue bloqueado");
    expect(desenharWorkspace).toContain("Tipo de levantamento");
    expect(ambiental).toContain("worker Python");
    expect(ambiental).toContain("module_environmental_analysis_jobs");
  });

  it("migration reaproveita tabelas de modulos e prepara marketplace", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/048_ferramentas_hub.sql"), "utf8");

    expect(migration).toContain("alter table if exists public.app_modules");
    expect(migration).toContain("pricing_mode");
    expect(migration).toContain("organization_modules");
    expect(migration).toContain("'portal-cliente'");
    expect(migration).toContain("'desenhar-geo'");
    expect(migration).toContain("'analise-ambiental'");
    expect(migration).toContain("'free_beta'");
  });
});
