import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { geoLayerClassifications } from "../../src/lib/geoquery";
import {
  buildGeoImportRow,
  getTargetTable,
  parseArgs,
  parsePositiveInteger,
  resolveClassification,
} from "./geojson-import-utils";
import { streamGeoJsonFeatures } from "./geojson-stream";

const SIMPLE_PREVIEW_MAX_BYTES = 80 * 1024 * 1024;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file;
  const classification = resolveClassification(args.classification);
  const output = args.output ?? "geoquery-import-preview.json";
  const limit = args.limit
    ? parsePositiveInteger(args.limit, 100, "--limit")
    : Number.POSITIVE_INFINITY;
  const sample = args.sample
    ? parsePositiveInteger(args.sample, 100, "--sample")
    : null;

  if (!file || !classification) {
    console.error(
      "Uso: npx tsx scripts/geo/import-geojson.ts --file base.geojson --classification CAR_COMPLETA --limit 100 --output preview.json",
    );
    console.error(`Classificacoes: ${geoLayerClassifications.join(", ")}`);
    process.exit(1);
  }

  const fileSizeBytes = statSync(file).size;
  if (fileSizeBytes > SIMPLE_PREVIEW_MAX_BYTES && !args.limit && !args.sample) {
    console.error(
      "Arquivo muito grande para preview simples. Use --limit, --sample ou importacao por lote.",
    );
    console.error(
      "Exemplo: npx tsx scripts/geo/import-geojson.ts --file base.geojson --classification CAR_COMPLETA --limit 100 --output preview.json",
    );
    process.exit(1);
  }

  const targetTable = getTargetTable(classification);
  const rows = [];
  let featureCount = 0;
  let completeCount = true;

  try {
    for await (const feature of streamGeoJsonFeatures(file)) {
      featureCount += 1;
      const previewLimit = sample ?? limit;

      if (rows.length < previewLimit) {
        rows.push(buildGeoImportRow(feature, classification));
      }

      if (sample && rows.length >= sample) {
        completeCount = false;
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ERR_STRING_TOO_LONG") || message.includes("Cannot create a string longer")) {
      console.error(
        "Arquivo muito grande para preview simples. Use --limit, --sample ou importacao por lote.",
      );
      process.exit(1);
    }
    throw error;
  }

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      {
        targetTable,
        classification,
        file,
        fileSizeBytes,
        recordCount: featureCount,
        sampleCount: rows.length,
        completeCount,
        limited: rows.length < featureCount || !completeCount,
        message: completeCount
          ? "Preview gerado por streaming."
          : "Preview gerado em modo sample; a contagem total foi interrompida de proposito.",
        rows,
      },
      null,
      2,
    ),
  );

  console.log(
    `Previa gerada em ${output}. Amostra: ${rows.length}. Contagem ${completeCount ? "total" : "parcial"}: ${featureCount}. Tabela: ${targetTable}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
