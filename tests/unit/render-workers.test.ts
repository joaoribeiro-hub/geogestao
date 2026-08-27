import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Render Free workers", () => {
  it("usa a porta PORT do Render com fallback local por worker", () => {
    expect(read("workers/buscageo/Dockerfile")).toContain("${PORT:-8010}");
    expect(read("workers/analise-ambiental/Dockerfile")).toContain("${PORT:-8020}");
    expect(read("workers/sophia-documents/Dockerfile")).toContain("${PORT:-8030}");
  });

  it("mantém health identificável e containers sem env local", () => {
    expect(read("workers/buscageo/main.py")).toContain('"service": "buscageo"');
    expect(read("workers/analise-ambiental/main.py")).toContain('"service": "analise-ambiental"');
    expect(read("workers/sophia-documents/main.py")).toContain('"service": "sophia-documents"');
    expect(read("workers/sophia-documents/.dockerignore")).toContain(".env.*");
  });

  it("declara os três serviços sem gravar secrets no blueprint", () => {
    const render = read("render.yaml");
    expect(render).toContain("geogestao-buscageo-worker");
    expect(render).toContain("geogestao-analise-ambiental-worker");
    expect(render).toContain("geogestao-sophia-documents-worker");
    expect(render).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*\n\s*value:/);
    expect(render).not.toMatch(/WORKER_SECRET\s*\n\s*value:/);
  });
});
