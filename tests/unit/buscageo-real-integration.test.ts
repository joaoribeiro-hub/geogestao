import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("BUSCAGEO-REAL-INTEGRATION-1", () => {
  it("migration 047 cria contrato completo de jobs, status e bucket privado", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/047_buscageo_real_integration.sql"),
      "utf8",
    );

    expect(migration).toContain("module_buscageo_jobs");
    expect(migration).toContain("storage.buckets");
    expect(migration).toContain("'documentos'");
    expect(migration).toContain("application/vnd.google-earth.kml+xml");
    expect(migration).toContain("application/vnd.google-earth.kmz");
    expect(migration).toContain("application/zip");
    expect(migration).toContain("geometry_ready");
    expect(migration).toContain("scenes_ready");
    expect(migration).toContain("worker_pending");
    expect(migration).toContain("module_buscageo_jobs_member_update");
    expect(migration).toContain("drop constraint if exists app_modules_status_check");
    expect(migration).toContain("'beta'");
  });

  it("tela BuscaGEO deixou de ser placeholder e tem fluxo operacional", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/modules/buscageo/buscageo-workspace.tsx"),
      "utf8",
    );

    expect(source).toContain("Salvar arquivo no BuscaGEO");
    expect(source).toContain("Ler area");
    expect(source).toContain("Buscar imagens");
    expect(source).toContain("Cenas CBERS");
    expect(source).toContain("Gerar GeoTIFF");
    expect(source).toContain("Baixar GeoTIFF final");
    expect(source).toContain("/api/modules/buscageo/jobs");
    expect(source).not.toContain("ModuleMigrationPage");
  });

  it("callback do worker exige segredo e usa admin server-side", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/modules/buscageo/worker/callback/route.ts"),
      "utf8",
    );

    expect(source).toContain("BUSCAGEO_WORKER_SECRET");
    expect(source).toContain("createAdminSupabase");
    expect(source).toContain("organization_id");
    expect(source).toContain("selected_scenes");
    expect(source).not.toContain("NEXT_PUBLIC");
  });

  it("worker FastAPI reaproveita logica CBERS/GDAL auditada", () => {
    const main = readFileSync(join(process.cwd(), "workers/buscageo/main.py"), "utf8");
    const processSource = readFileSync(join(process.cwd(), "workers/buscageo/app/process.py"), "utf8");
    const requirements = readFileSync(join(process.cwd(), "workers/buscageo/requirements.txt"), "utf8");

    expect(main).toContain("FastAPI");
    expect(main).toContain("/jobs/{job_id}/search-scenes");
    expect(processSource).toContain("search_cbers_images");
    expect(processSource).toContain("process_mosaic");
    expect(processSource).toContain("upload_file");
    expect(requirements).toContain("GDAL");
    expect(requirements).toContain("supabase");
  });

  it("worker tem artefatos de producao Docker e documenta variaveis", () => {
    const dockerfile = readFileSync(join(process.cwd(), "workers/buscageo/Dockerfile"), "utf8");
    const productionReadme = readFileSync(join(process.cwd(), "workers/buscageo/README_PRODUCTION.md"), "utf8");
    const main = readFileSync(join(process.cwd(), "workers/buscageo/main.py"), "utf8");
    const security = readFileSync(join(process.cwd(), "workers/buscageo/app/security.py"), "utf8");

    expect(main).toContain('@app.get("/health")');
    expect(dockerfile).toContain("python -m uvicorn main:app --host 0.0.0.0");
    expect(dockerfile).toContain("${PORT:-8010}");
    expect(dockerfile).toContain("gdal-bin");
    expect(productionReadme).toContain("Railway");
    expect(productionReadme).toContain("Render");
    expect(productionReadme).toContain("Fly");
    expect(productionReadme).toContain("BUSCAGEO_WORKER_URL");
    expect(productionReadme).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(productionReadme).toContain("Nunca coloque essa chave no frontend");
    expect(security).toContain("BUSCAGEO_WORKER_SECRET");
    expect(security).toContain("authorization");
    expect(security).toContain("Bearer ");
  });
});
