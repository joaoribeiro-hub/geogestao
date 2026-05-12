import { basename } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { geoLayerClassifications, type GeoTargetTable } from "../../src/lib/geoquery";
import type { Database } from "../../src/types/database";
import {
  buildGeoImportRow,
  getTargetTable,
  parseArgs,
  parsePositiveInteger,
  resolveClassification,
  sourceTypeForTargetTable,
  type GeoImportRow,
} from "./geojson-import-utils";
import { streamGeoJsonFeatures } from "./geojson-stream";

type AdminClient = SupabaseClient<Database>;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file;
  const classification = resolveClassification(args.classification);
  const batchSize = parsePositiveInteger(args["batch-size"], 100, "--batch-size");
  const dryRun = args["dry-run"] === "true";
  const organizationId = optionalArg(args["organization-id"]);

  if (!file || !classification) {
    console.error(
      "Uso: npx tsx scripts/geo/import-geojson-to-supabase.ts --file base.geojson --classification CAR_COMPLETA --batch-size 100",
    );
    console.error(`Classificacoes: ${geoLayerClassifications.join(", ")}`);
    process.exit(1);
  }

  const targetTable = getTargetTable(classification);
  const sourceType = sourceTypeForTargetTable(targetTable);
  const sourceName = args["source-name"] ?? basename(file);
  const provider = optionalArg(args.provider);
  const referenceYear = optionalArg(args["reference-year"]);
  const supabase = dryRun ? null : createAdminClient();
  const sourceId = supabase
    ? await createDataSource(supabase, {
        sourceType,
        sourceName,
        provider,
        referenceYear,
        file,
        organizationId,
        classification,
      })
    : null;

  let readCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;
  let batch: GeoImportRow[] = [];

  try {
    for await (const feature of streamGeoJsonFeatures(file)) {
      readCount += 1;
      const row = {
        ...buildGeoImportRow(feature, classification),
        organization_id: organizationId,
        source_id: sourceId,
      };

      batch.push(row);
      if (batch.length >= batchSize) {
        const result = await flushBatch({
          supabase,
          targetTable,
          batch,
          organizationId,
          dryRun,
        });
        insertedCount += result.inserted;
        skippedCount += result.skipped;
        batch = [];
        printProgress(readCount, insertedCount, skippedCount, targetTable);
      }
    }

    if (batch.length) {
      const result = await flushBatch({
        supabase,
        targetTable,
        batch,
        organizationId,
        dryRun,
      });
      insertedCount += result.inserted;
      skippedCount += result.skipped;
    }

    if (supabase && sourceId) {
      await updateDataSource(supabase, sourceId, {
        status: "imported",
        recordCount: insertedCount,
      });
    }

    console.log("Importacao concluida.");
    console.log(`Arquivo: ${file}`);
    console.log(`Classificacao: ${classification}`);
    console.log(`Tabela: ${targetTable}`);
    console.log(`Features lidas: ${readCount}`);
    console.log(`Registros inseridos: ${insertedCount}`);
    console.log(`Registros ignorados: ${skippedCount}`);
    if (dryRun) console.log("Modo dry-run: nenhum registro foi gravado no Supabase.");
  } catch (error) {
    if (supabase && sourceId) {
      await updateDataSource(supabase, sourceId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : String(error),
        recordCount: insertedCount,
      }).catch(() => null);
    }
    throw error;
  }
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente local/admin. Nunca exponha service_role no frontend.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function createDataSource(
  supabase: AdminClient,
  input: {
    sourceType: "car" | "incra" | "alerta" | "tematica";
    sourceName: string;
    provider: string | null;
    referenceYear: string | null;
    file: string;
    organizationId: string | null;
    classification: string;
  },
) {
  const { data, error } = await supabase
    .from("geo_data_sources")
    .insert({
      organization_id: input.organizationId,
      source_type: input.sourceType,
      name: input.sourceName,
      provider: input.provider,
      reference_year: input.referenceYear,
      original_file_name: basename(input.file),
      original_file_path: input.file,
      imported_at: new Date().toISOString(),
      status: "pending",
      metadata: { classification: input.classification },
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function updateDataSource(
  supabase: AdminClient,
  sourceId: string,
  input: {
    status: "imported" | "failed";
    recordCount: number;
    errorMessage?: string;
  },
) {
  const { error } = await supabase
    .from("geo_data_sources")
    .update({
      status: input.status,
      record_count: input.recordCount,
      error_message: input.errorMessage ?? null,
      imported_at: new Date().toISOString(),
    })
    .eq("id", sourceId);

  if (error) throw error;
}

async function flushBatch(input: {
  supabase: AdminClient | null;
  targetTable: GeoTargetTable;
  batch: GeoImportRow[];
  organizationId: string | null;
  dryRun: boolean;
}) {
  if (input.dryRun || !input.supabase) {
    const skipped = input.targetTable === "car_properties"
      ? input.batch.filter((row) => !hasCarCode(row)).length
      : 0;
    return { inserted: input.batch.length - skipped, skipped };
  }

  if (input.targetTable === "car_properties") {
    return insertCarRows(input.supabase, input.batch, input.organizationId);
  }

  if (input.targetTable === "incra_properties") {
    const { error } = await input.supabase
      .from("incra_properties")
      .insert(input.batch as Database["public"]["Tables"]["incra_properties"]["Insert"][]);
    if (error) throw error;
    return { inserted: input.batch.length, skipped: 0 };
  }

  if (input.targetTable === "geo_alert_layers") {
    const { error } = await input.supabase
      .from("geo_alert_layers")
      .insert(input.batch as Database["public"]["Tables"]["geo_alert_layers"]["Insert"][]);
    if (error) throw error;
    return { inserted: input.batch.length, skipped: 0 };
  }

  const { error } = await input.supabase
    .from("geo_thematic_layers")
    .insert(input.batch as Database["public"]["Tables"]["geo_thematic_layers"]["Insert"][]);
  if (error) throw error;
  return { inserted: input.batch.length, skipped: 0 };
}

async function insertCarRows(
  supabase: AdminClient,
  batch: GeoImportRow[],
  organizationId: string | null,
) {
  const uniqueRows = new Map<string, GeoImportRow>();
  let skipped = 0;

  batch.forEach((row) => {
    if (!hasCarCode(row)) {
      skipped += 1;
      return;
    }
    if (uniqueRows.has(row.cod_car)) {
      skipped += 1;
      return;
    }
    uniqueRows.set(row.cod_car, row);
  });

  const codes = [...uniqueRows.keys()];
  if (!codes.length) return { inserted: 0, skipped };

  let query = supabase.from("car_properties").select("cod_car").in("cod_car", codes);
  query = organizationId ? query.eq("organization_id", organizationId) : query.is("organization_id", null);

  const { data, error } = await query;
  if (error) throw error;

  const existing = new Set((data ?? []).map((row) => row.cod_car));
  const rowsToInsert = [...uniqueRows.values()].filter((row) => {
    if (!hasCarCode(row)) return false;
    return !existing.has(row.cod_car);
  });

  skipped += uniqueRows.size - rowsToInsert.length;
  if (!rowsToInsert.length) return { inserted: 0, skipped };

  const { error: insertError } = await supabase
    .from("car_properties")
    .insert(rowsToInsert as Database["public"]["Tables"]["car_properties"]["Insert"][]);
  if (insertError) throw insertError;

  return { inserted: rowsToInsert.length, skipped };
}

function hasCarCode(row: GeoImportRow): row is GeoImportRow & { cod_car: string } {
  return typeof row.cod_car === "string" && row.cod_car.trim().length > 0;
}

function printProgress(
  readCount: number,
  insertedCount: number,
  skippedCount: number,
  targetTable: GeoTargetTable,
) {
  console.log(
    `[${targetTable}] lidas=${readCount} inseridas=${insertedCount} ignoradas=${skippedCount}`,
  );
}

function optionalArg(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized !== "true" ? normalized : null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
