import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculatePerimeter,
  createDxf,
  parseBearingInput,
  parseDms,
} from "@/lib/tools/desenhar-geo/geometry";

describe("proximas fases das ferramentas", () => {
  it("Desenhar GEO calcula quadrado por azimute e gera DXF", () => {
    const result = calculatePerimeter({
      mode: "azimuth",
      rows: [
        { direction: "0", distance: 100, confrontant: "Norte" },
        { direction: "90", distance: 100, confrontant: "Leste" },
        { direction: "180", distance: 100, confrontant: "Sul" },
        { direction: "270", distance: 100, confrontant: "Oeste" },
      ],
    });

    expect(result.perimeter).toBe(400);
    expect(result.closureError).toBeLessThan(0.000001);
    expect(result.vertices).toHaveLength(5);
    expect(createDxf(result)).toContain("SECTION");
    expect(createDxf(result)).toContain("PERIMETRO");
  });

  it("Desenhar GEO interpreta DMS e rumo quadrantal", () => {
    expect(parseDms("10°30'00\"")).toBeCloseTo(10.5);
    expect(parseBearingInput("S 32°15'20\" E")).toBeCloseTo(147.744444, 5);
    expect(parseBearingInput("45 NE")).toBeCloseTo(45);
    expect(parseBearingInput("N45W")).toBeCloseTo(315);
  });

  it("Portal do Cliente tem API, painel no servico e rota publica por token", () => {
    const servicePage = readFileSync(join(process.cwd(), "src/app/(app)/servicos/[id]/page.tsx"), "utf8");
    const api = readFileSync(join(process.cwd(), "src/app/api/client-portals/service/[serviceId]/route.ts"), "utf8");
    const publicPage = readFileSync(join(process.cwd(), "src/app/p/[token]/page.tsx"), "utf8");

    expect(servicePage).toContain("ServiceClientPortalPanel");
    expect(api).toContain("randomBytes(32)");
    expect(api).toContain("createHash(\"sha256\")");
    expect(publicPage).toContain("get_public_client_portal");
    expect(publicPage).toContain("Acompanhamento do serviço");
  });

  it("Analise Ambiental cria job com storage privado e historico por organizacao", () => {
    const api = readFileSync(join(process.cwd(), "src/app/api/tools/analise-ambiental/jobs/route.ts"), "utf8");
    const page = readFileSync(join(process.cwd(), "src/app/(app)/ferramentas/analise-ambiental/page.tsx"), "utf8");
    const uploader = readFileSync(
      join(process.cwd(), "src/components/tools/analise-ambiental/environmental-analysis-uploader.tsx"),
      "utf8",
    );

    expect(api).toContain("module_environmental_analysis_jobs");
    expect(api).toContain("organizations/${organization.id}/tools/analise-ambiental");
    expect(api).toContain("worker_pendente");
    expect(page).toContain("EnvironmentalAnalysisUploader");
    expect(uploader).toContain("Arquivo KML/KMZ/ZIP");
  });

  it("migration 049 cria tabelas, RLS e funcao publica segura", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/049_tools_next_phases.sql"), "utf8");

    expect(migration).toContain("create table if not exists public.client_portals");
    expect(migration).toContain("create table if not exists public.client_portal_links");
    expect(migration).toContain("create table if not exists public.module_environmental_analysis_jobs");
    expect(migration).toContain("security definer");
    expect(migration).toContain("get_public_client_portal");
    expect(migration).toContain("public.is_org_member");
  });
});
