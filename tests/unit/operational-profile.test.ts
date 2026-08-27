import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isBoardVisibleForProfile,
  isToolVisibleForProfile,
  normalizeOperationalProfile,
  slugifyOperationalName,
} from "@/lib/operational-profile";

describe("perfis operacionais", () => {
  it("usa agrimensura como fallback e preserva perfis válidos", () => {
    expect(normalizeOperationalProfile(undefined)).toBe("agrimensura");
    expect(normalizeOperationalProfile("arquitetura")).toBe("arquitetura");
    expect(normalizeOperationalProfile("inexistente")).toBe("agrimensura");
  });

  it("filtra ferramentas técnicas e mantém Portal universal", () => {
    expect(isToolVisibleForProfile("gerador-rw5", "agrimensura")).toBe(true);
    expect(isToolVisibleForProfile("gerador-rw5", "padrao")).toBe(false);
    expect(isToolVisibleForProfile("portal-cliente", "arquitetura")).toBe(true);
  });

  it("isola boards personalizados pela organização e pelo perfil", () => {
    expect(isBoardVisibleForProfile({ slug: "georreferenciamento" }, "agrimensura", "org-1")).toBe(true);
    expect(isBoardVisibleForProfile({ slug: "georreferenciamento" }, "padrao", "org-1")).toBe(false);
    expect(isBoardVisibleForProfile({ slug: "arquitetura-residencial", organization_id: "org-2", operational_profile: "arquitetura" }, "arquitetura", "org-1")).toBe(false);
    expect(isBoardVisibleForProfile({ slug: "arquitetura-residencial", organization_id: "org-1", operational_profile: "arquitetura" }, "arquitetura", "org-1")).toBe(true);
  });

  it("normaliza nomes para slugs seguros", () => {
    expect(slugifyOperationalName("Projeto Residencial / Fase 1")).toBe("projeto-residencial-fase-1");
  });

  it("liga a UI da fase aos pontos persistentes", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8");
    const services = readFileSync(join(process.cwd(), "src/app/(app)/servicos/page.tsx"), "utf8");
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/056_ui_profiles_service_editor.sql"), "utf8");
    expect(shell).toContain("OperationalProfileSwitcher");
    expect(shell).toContain("CommandMenu");
    expect(services).toContain("ServiceBoardEditor");
    expect(migration).toContain("operational_profile");
    expect(migration).toContain("organization_service_board_settings");
  });
});
