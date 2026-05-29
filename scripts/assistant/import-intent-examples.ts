import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  actionNameForIntent,
  categoryForIntent,
  parseIntentDataset,
  sourceHash,
  type ParsedIntentExample,
} from "../../src/lib/assistant/intent-example-parser";

type Args = {
  file?: string;
  confirm: boolean;
};

const batchSize = 500;

type AdminSupabaseClient = SupabaseClient<any, "public", any>;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("Informe --file=<caminho-do-arquivo>.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }

  const content = readFileSync(args.file, "utf8");
  const hash = sourceHash(content);
  const sourceFile = basename(args.file);
  const source = sourceFile.replace(/\.[^.]+$/, "");
  const summary = parseIntentDataset(content);

  console.log(`Arquivo: ${sourceFile}`);
  console.log(`Hash: ${hash.slice(0, 12)}...`);
  console.log(args.confirm ? "Modo: CONFIRMADO" : "Modo: DRY-RUN");
  console.table({
    totalLines: summary.totalLines,
    validExamples: summary.importedCount,
    skippedLines: summary.skippedCount,
    duplicatesInFile: summary.duplicateCount,
    unknown: summary.unknownCount,
    intents: Object.keys(summary.intents).length,
  });
  console.table(topIntentCounts(summary.intents));

  if (!args.confirm) {
    console.log("Nenhum dado foi importado. Rode novamente com --confirm para gravar.");
    return;
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: previousImports } = await supabase
    .from("assistant_dataset_imports")
    .select("id,imported_at")
    .eq("source_hash", hash)
    .limit(1);
  if (previousImports?.length) {
    console.log("Aviso: este hash ja foi importado antes. O upsert evitara duplicar exemplos.");
  }

  const intentIds = await upsertIntents(supabase, summary.examples);
  await upsertExamples(supabase, summary.examples, intentIds, source, sourceFile);

  const { error: importError } = await supabase.from("assistant_dataset_imports").insert({
    source_file: sourceFile,
    source_hash: hash,
    total_lines: summary.totalLines,
    imported_count: summary.importedCount,
    skipped_count: summary.skippedCount,
    duplicate_count: summary.duplicateCount,
    unknown_count: summary.unknownCount,
    notes: "Importacao admin de exemplos/intents do Assistente IA.",
  });
  if (importError) throw new Error(importError.message);

  console.log("Importacao concluida sem imprimir frases completas.");
}

async function upsertIntents(
  supabase: AdminSupabaseClient,
  examples: ParsedIntentExample[],
) {
  const intentNames = Array.from(new Set(examples.map((example) => example.intentName)));
  const payload = intentNames.map((name) => ({
    name,
    description: `Intent importada da base privada: ${name}`,
    category: categoryForIntent(name),
    action_name: actionNameForIntent(name),
    enabled: true,
  }));

  for (const batch of chunks(payload, batchSize)) {
    const { error } = await supabase
      .from("assistant_intents")
      .upsert(batch, { onConflict: "name" });
    if (error) throw new Error(error.message);
  }

  const { data, error } = await supabase
    .from("assistant_intents")
    .select("id,name")
    .in("name", intentNames);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((intent) => [intent.name as string, intent.id as string]));
}

async function upsertExamples(
  supabase: AdminSupabaseClient,
  examples: ParsedIntentExample[],
  intentIds: Map<string, string>,
  source: string,
  sourceFile: string,
) {
  const rows = examples.flatMap((example) => {
    const intentId = intentIds.get(example.intentName);
    if (!intentId) return [];
    return {
      intent_id: intentId,
      raw_text: example.rawText,
      normalized_text: example.normalizedText,
      source,
      source_file: sourceFile,
      source_line: example.sourceLine,
      synonym: example.synonym ?? null,
      params_sample: example.paramsSample,
      entities_sample: example.entitiesSample,
      requires_confirmation: example.requiresConfirmation ?? null,
      confidence: example.confidence ?? null,
      is_real_data: true,
      is_active: true,
    };
  });

  let imported = 0;
  for (const batch of chunks(rows, batchSize)) {
    const { error } = await supabase
      .from("assistant_intent_examples")
      .upsert(batch, { onConflict: "intent_id,normalized_text,source" });
    if (error) throw new Error(error.message);
    imported += batch.length;
    if (imported % 5000 === 0) console.log(`Importados/processados: ${imported}`);
  }
}

function parseArgs(rawArgs: string[]): Args {
  return rawArgs.reduce<Args>(
    (acc, arg) => {
      if (arg === "--confirm") return { ...acc, confirm: true };
      if (arg === "--dry-run") return { ...acc, confirm: false };
      if (arg.startsWith("--file=")) return { ...acc, file: arg.split("=").slice(1).join("=") };
      return acc;
    },
    { confirm: false },
  );
}

function topIntentCounts(intents: Record<string, number>) {
  return Object.entries(intents)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([intent, count]) => ({ intent, count }));
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
