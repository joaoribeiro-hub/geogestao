import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ANALISE-AMBIENTAL-WORKER-1", () => {
  it("cria contrato Next para acionar worker e assinar outputs", () => {
    const jobsRoute = readFileSync(join(process.cwd(), "src/app/api/tools/analise-ambiental/jobs/route.ts"), "utf8");
    const detailRoute = readFileSync(join(process.cwd(), "src/app/api/tools/analise-ambiental/jobs/[id]/route.ts"), "utf8");
    const processRoute = readFileSync(
      join(process.cwd(), "src/app/api/tools/analise-ambiental/jobs/[id]/process/route.ts"),
      "utf8",
    );
    const outputsRoute = readFileSync(
      join(process.cwd(), "src/app/api/tools/analise-ambiental/jobs/[id]/outputs/route.ts"),
      "utf8",
    );

    expect(jobsRoute).toContain("requestEnvironmentalWorkerProcess");
    expect(jobsRoute).toContain("export async function GET");
    expect(detailRoute).toContain("maybeSingle");
    expect(processRoute).toContain("organization.id");
    expect(outputsRoute).toContain("createSignedUrl");
    expect(outputsRoute).toContain("organizations/${organization.id}/");
    expect(outputsRoute).toContain("environmental_analysis_outputs");
  });

  it("worker Python tem endpoints e provider fixture/GEE separado", () => {
    const main = readFileSync(join(process.cwd(), "workers/analise-ambiental/main.py"), "utf8");
    const runner = readFileSync(join(process.cwd(), "workers/analise-ambiental/app/runner.py"), "utf8");
    const repo = readFileSync(join(process.cwd(), "workers/analise-ambiental/app/supabase_repo.py"), "utf8");
    const fixtureProvider = readFileSync(
      join(process.cwd(), "workers/analise-ambiental/app/providers/local_raster.py"),
      "utf8",
    );
    const geeProvider = readFileSync(join(process.cwd(), "workers/analise-ambiental/app/providers/gee.py"), "utf8");

    expect(main).toContain("@app.get(\"/health\")");
    expect(main).toContain("@app.post(\"/jobs/{job_id}/process\"");
    expect(main).toContain("@app.post(\"/jobs/poll\"");
    expect(repo).toContain("module_environmental_analysis_jobs");
    expect(repo).toContain("environmental_analysis_outputs");
    expect(runner).toContain("layer_key=\"limite\"");
    expect(runner).toContain("vegetacao_existente");
    expect(runner).toContain("agua_represa");
    expect(runner).toContain("drenagem_corrego");
    expect(runner).toContain("pacote_resultados.zip");
    expect(runner).toContain("relatorio_ambiental.json");
    expect(fixtureProvider).toContain("source = \"dev_fixture\"");
    expect(geeProvider).toContain("Google Earth Engine desativado");
  });

  it("migration 051 cria outputs por camada e status completos", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/051_analise_ambiental_layers_outputs.sql"),
      "utf8",
    );

    expect(migration).toContain("create table if not exists public.environmental_analysis_outputs");
    expect(migration).toContain("'limite_extraido'");
    expect(migration).toContain("'provider_pendente'");
    expect(migration).toContain("'gerando_outputs'");
    expect(migration).toContain("unique (organization_id, job_id, layer_key, output_format)");
  });

  it("frontend lista outputs ambientais por camada", () => {
    const uploader = readFileSync(
      join(process.cwd(), "src/components/tools/analise-ambiental/environmental-analysis-uploader.tsx"),
      "utf8",
    );

    expect(uploader).toContain("Baixar KML");
    expect(uploader).toContain("Baixar GeoJSON");
    expect(uploader).toContain("Baixar SHP");
    expect(uploader).toContain("Baixar pacote completo");
    expect(uploader).toContain("vegetacao_existente");
    expect(uploader).toContain("agua_represa");
    expect(uploader).toContain("drenagem_corrego");
  });

  it("migration 050 adiciona outputs, progresso e status do worker", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/050_analise_ambiental_worker.sql"),
      "utf8",
    );

    expect(migration).toContain("output_storage_paths");
    expect(migration).toContain("result_summary");
    expect(migration).toContain("geometry_geojson");
    expect(migration).toContain("'reading_aoi'");
    expect(migration).toContain("'completed'");
    expect(migration).toContain("notify pgrst");
  });

  it("documenta variaveis do worker no env example", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const workerEnv = readFileSync(join(process.cwd(), "workers/analise-ambiental/.env.example"), "utf8");

    expect(envExample).toContain("ANALISE_AMBIENTAL_WORKER_URL");
    expect(envExample).toContain("ANALISE_AMBIENTAL_WORKER_SECRET");
    expect(workerEnv).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(workerEnv).toContain("ANALISE_AMBIENTAL_LOCAL_FIXTURE_ENABLED");
  });
});
