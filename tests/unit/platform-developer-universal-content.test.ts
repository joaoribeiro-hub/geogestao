import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isPlatformDeveloper } from "@/lib/platform/platform-auth";
import {
  buildUniversalAnnouncementPath,
  buildUniversalDocumentPath,
  sanitizeUniversalFileName,
  UNIVERSAL_CONTENT_MAX_BYTES,
  validateUniversalFile,
} from "@/lib/platform/universal-content";
import { sanitizeSophiaGlobalTemplate } from "@/lib/sophia/v4/privacy-sanitizer";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("GEOGESTAO-PLATFORM-DEVELOPER-UNIVERSAL-CONTENT-1", () => {
  afterEach(() => { delete process.env.PLATFORM_DEVELOPER_EMAILS; });

  it("distingue desenvolvedor ativo de usuario comum", async () => {
    expect(await isPlatformDeveloper(fakePlatformClient(true) as never, "developer-id")).toBe(true);
    expect(await isPlatformDeveloper(fakePlatformClient(false) as never, "member-id")).toBe(false);
  });

  it("mantem as rotas tecnicas fora do papel owner", () => {
    const shell = source("src/components/layout/app-shell.tsx");
    expect(shell).toContain('href: "/sistema/workers"');
    expect(shell).toContain("platformOnly: true");
    expect(shell).toContain("isPlatformDeveloper");
    expect(source("src/app/api/system/workers/route.ts")).toContain("requirePlatformDeveloper");
    expect(source("src/app/api/sophia/reflections/route.ts")).toContain("requirePlatformDeveloper");
    expect(source("src/app/api/sophia/evals/route.ts")).toContain("requirePlatformDeveloper");
  });

  it("gera caminhos globais fechados e sanitiza nomes", () => {
    expect(sanitizeUniversalFileName("Lei nº 12/Arquivo final.pdf")).toBe("Lei-n-12-Arquivo-final.pdf");
    expect(buildUniversalDocumentPath("legislacao", "doc-id", "Lei nº 12.pdf")).toBe("global/universal-documents/legislacao/doc-id/Lei-n-12.pdf");
    expect(buildUniversalAnnouncementPath("announcement-id", "Comunicado geral.pdf")).toBe("global/universal-announcements/announcement-id/Comunicado-geral.pdf");
  });

  it("valida MIME e limite de 50 MB", () => {
    expect(validateUniversalFile({ size: 100, type: "application/pdf" })).toBeNull();
    expect(validateUniversalFile({ size: UNIVERSAL_CONTENT_MAX_BYTES + 1, type: "application/pdf" })).toContain("50 MB");
    expect(validateUniversalFile({ size: 100, type: "application/x-msdownload" })).toContain("nao e permitido");
  });

  it("usa anuncios ativos sem fanout e leitura individual", () => {
    const migration = source("supabase/migrations/060_platform_developer_universal_content.sql");
    const notifications = source("src/app/api/notifications/route.ts");
    expect(migration).toContain("create table if not exists public.universal_announcements");
    expect(migration).toContain("create table if not exists public.universal_announcement_reads");
    expect(migration).toContain("user_id = auth.uid()");
    expect(notifications).toContain("loadUniversalAnnouncements");
    expect(notifications).toContain("universal_announcement_reads");
  });

  it("protege escrita universal no banco e nas APIs", () => {
    const migration = source("supabase/migrations/060_platform_developer_universal_content.sql");
    expect(migration).toContain('create policy "universal_documents_platform_write"');
    expect(migration).toContain('create policy "universal_announcements_platform_write"');
    expect(migration).toContain("public.is_platform_developer()");
    expect(source("src/app/api/universal-documents/route.ts")).toContain("requirePlatformDeveloper");
    expect(source("src/app/api/universal-announcements/route.ts")).toContain("requirePlatformDeveloper");
  });

  it("sanitiza candidatos globais da Sophia antes da revisao", () => {
    const sanitized = sanitizeSophiaGlobalTemplate("Cliente Fazenda Boa Vista, CPF 123.456.789-10, email dono@example.com e valor R$ 4.500,00");
    expect(sanitized).not.toContain("Boa Vista");
    expect(sanitized).not.toContain("123.456.789-10");
    expect(sanitized).not.toContain("dono@example.com");
    expect(source("src/lib/sophia/v4/reflexion-loop.ts")).toContain('rpc("submit_sophia_global_candidate"');
    expect(source("supabase/migrations/060_platform_developer_universal_content.sql")).toContain("create or replace function public.submit_sophia_global_candidate");
  });

  it("reduz os botoes flutuantes e preserva alvo acessivel", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain("width: 44px");
    expect(css).toContain("width: 56px");
    expect(css).toContain("width: 19px !important");
    expect(css).toContain("width: 25px !important");
  });
});

function fakePlatformClient(active: boolean) {
  const query = {
    eq() { return query; },
    async maybeSingle() {
      return active
        ? { data: { id: "dev", user_id: "developer-id", email: "dev@example.com", role: "developer", is_active: true }, error: null }
        : { data: null, error: null };
    },
  };
  return { from: () => ({ select: () => query }) };
}
