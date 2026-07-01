import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_MODULES, getModuleByKey } from "@/lib/modules/app-modules";

describe("module hub", () => {
  it("registra os modulos esperados com rotas internas", () => {
    expect(APP_MODULES.map((module) => module.key)).toEqual([
      "geogestao",
      "meu-imovel-car",
      "buscageo",
      "corretor-rtk-ppp",
      "gerador-rw5",
      "app-2026-05-29",
    ]);
    expect(getModuleByKey("meu-imovel-car")?.route).toBe("/modulos/meu-imovel-car");
    expect(getModuleByKey("gerador-rw5")?.route).toBe("/modulos/gerador-rw5");
    expect(getModuleByKey("buscageo")?.status).toBe("beta");
    expect(getModuleByKey("app-2026-05-29")?.status).toBe("indisponivel");
  });

  it("usa o switcher no topo do AppShell", () => {
    const appShell = readFileSync(join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8");

    expect(appShell).toContain("ModuleSwitcher");
    expect(appShell).not.toContain("<Archive");
  });

  it("migration cria tabelas, seed e preferencias de usuario", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/044_module_hub_external_apps.sql"),
      "utf8",
    );

    expect(migration).toContain("create table if not exists public.app_modules");
    expect(migration).toContain("create table if not exists public.organization_modules");
    expect(migration).toContain("create table if not exists public.module_activity_logs");
    expect(migration).toContain("create table if not exists public.user_preferences");
    expect(migration).toContain("font_scale numeric not null default 1.2");
    expect(migration).toContain("'meu-imovel-car'");
    expect(migration).toContain("'buscageo'");
  });

  it("rotas de modulos usam tela real quando ha fluxo auditado", () => {
    const meuImovel = readFileSync(join(process.cwd(), "src/app/(app)/modulos/meu-imovel-car/page.tsx"), "utf8");
    const buscageo = readFileSync(join(process.cwd(), "src/app/(app)/modulos/buscageo/page.tsx"), "utf8");
    const appMissing = readFileSync(join(process.cwd(), "src/app/(app)/modulos/app-2026-05-29/page.tsx"), "utf8");

    expect(meuImovel).toContain("Buscar im");
    expect(buscageo).toContain("BuscaGeoWorkspace");
    expect(appMissing).toContain("ModuleMigrationPage");
  });
});
