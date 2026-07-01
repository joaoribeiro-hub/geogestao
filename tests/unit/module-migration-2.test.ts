import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRtkText, calculateRtkCorrection } from "@/lib/modules/rtk-ppp/converter";
import { buildBasicRw5, parseRw5Text } from "@/lib/modules/rw5/converter";

describe("MODULE-HUB-MIGRATION-2", () => {
  it("interpreta RTK/PPP e calcula delta", () => {
    const parsed = parseRtkText("base_1\tBASE\t1000\t2000\t500\n1\tP1\t1001\t2001\t501\n2\tP2\t1002\t2002\t502");

    expect(parsed.base?.id).toBe("base_1");
    expect(parsed.rovers).toHaveLength(2);

    const corrected = calculateRtkCorrection({
      base: parsed.base!,
      correctedBase: { northing: 1005, easting: 1998, elevation: 503 },
      rovers: parsed.rovers,
      decimals: 3,
      outputDelimiter: "\t",
      includeCorrectedBase: true,
    });

    expect(corrected.correction).toEqual({ deltaN: 5, deltaE: -2, deltaH: 3 });
    expect(corrected.correctedPoints[0]?.correctedNorthing).toBe(1006);
    expect(corrected.resultText).toContain("BASE_CORRIGIDA");
  });

  it("interpreta pontos para RW5 e gera arquivo inicial", () => {
    const parsed = parseRw5Text([
      "base_1\tBASE\t7500000\t500000\t500\t-\t0\t0\t1.093\t26\t26\tAutonomo\t0.01\t0.01\t0.01\t0.014\t0.02\t2026-02-21 08:00:00\t2026-02-21 08:00:00",
      "1\tP1\t7500001\t500001\t501\tbase_1\t1.8\t1\t1.093\t26\t26\tFixo\t0.01\t0.01\t0.01\t0.014\t0.02\t2026-02-21 08:01:00\t2026-02-21 08:01:00",
    ].join("\n"));
    const rw5 = buildBasicRw5({ points: parsed.points, filename: "teste.txt" });

    expect(parsed.baseCount).toBe(1);
    expect(parsed.pointCount).toBe(1);
    expect(parsed.inputFormat).toBe("MC");
    expect(rw5).toContain("JB,NMteste");
    expect(rw5).toContain("BP,base_1");
    expect(rw5).toContain("GPS,PN1");
    expect(rw5).toContain("G1,BPbase_1,PN1");
  });

  it("migration registra tabelas e modulos beta", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/045_module_hub_migration_2.sql"),
      "utf8",
    );

    expect(migration).toContain("module_rtk_ppp_jobs");
    expect(migration).toContain("module_rw5_jobs");
    expect(migration).toContain("module_meuimovel_saved_results");
    expect(migration).toContain("'corretor-rtk-ppp'");
    expect(migration).toContain("'gerador-rw5'");
  });

  it("migration real port cria BuscaGEO e complementa RW5", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/046_module_hub_real_port.sql"),
      "utf8",
    );

    expect(migration).toContain("module_buscageo_jobs");
    expect(migration).toContain("drop constraint if exists app_modules_status_check");
    expect(migration).toContain("worker_pendente");
    expect(migration).toContain("output_filename");
    expect(migration).toContain("module_meu_imovel_queries");
    expect(migration).toContain("organization_id");
  });

  it("nao usa servidor local antigo nos modulos portados", () => {
    const files = [
      "src/lib/modules/rtk-ppp/converter.ts",
      "src/lib/modules/rw5/converter.ts",
      "src/app/api/modules/rtk-ppp/parse/route.ts",
      "src/app/api/modules/rw5/generate/route.ts",
    ];
    const source = files.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");

    expect(source).not.toContain("ThreadingHTTPServer");
    expect(source).not.toContain("127.0.0.1:8765");
    expect(source).not.toContain("webbrowser.open");
  });
});
