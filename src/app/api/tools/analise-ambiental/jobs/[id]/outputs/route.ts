import { NextResponse } from "next/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";

type OutputMap = Record<string, string>;
type OutputRecord = {
  layer_key?: string | null;
  layer_name?: string | null;
  output_format?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  file_name?: string | null;
  area_ha?: number | string | null;
  length_m?: number | string | null;
  confidence?: string | null;
  provider?: string | null;
  official_data?: boolean | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const organization = context.organization;
  if (!organization || !context.membership) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 403 });
  }

  const db = asUntypedSupabase(supabase);
  const { data: job, error } = await db
    .from("module_environmental_analysis_jobs")
    .select("id,organization_id,result_storage_path,output_storage_paths")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job ambiental não encontrado." }, { status: 404 });
  }

  const { data: outputRows, error: outputsError } = await db
    .from<OutputRecord>("environmental_analysis_outputs")
    .select(
      "layer_key,layer_name,output_format,storage_bucket,storage_path,file_name,area_ha,length_m,confidence,provider,official_data",
    )
    .eq("job_id", id)
    .eq("organization_id", organization.id)
    .order("layer_key", { ascending: true });

  if (outputsError) {
    return NextResponse.json({ error: outputsError.message }, { status: 500 });
  }

  const normalizedRows =
    outputRows && outputRows.length
      ? outputRows.filter((row) => typeof row.storage_path === "string")
      : legacyRowsFromOutputMap(normalizeOutputPaths(job.output_storage_paths, job.result_storage_path));

  const signedOutputs = await Promise.all(
    normalizedRows.map(async (output) => {
      const path = String(output.storage_path ?? "");
      if (!path.startsWith(`organizations/${organization.id}/`)) {
        return { ...output, path, signedUrl: null, error: "Path fora da organização atual." };
      }
      const bucket = output.storage_bucket || DOCUMENTS_BUCKET;
      const { data, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
      return {
        key: `${output.layer_key}_${output.output_format}`,
        ...output,
        path,
        signedUrl: data?.signedUrl ?? null,
        error: signedError?.message ?? null,
      };
    }),
  );

  return NextResponse.json({ outputs: signedOutputs });
}

function legacyRowsFromOutputMap(outputPaths: OutputMap): OutputRecord[] {
  return Object.entries(outputPaths).map(([key, path]) => {
    const { layerKey, format } = parseLegacyKey(key);
    return {
      layer_key: layerKey,
      layer_name: formatLayerName(layerKey),
      output_format: format,
      storage_bucket: DOCUMENTS_BUCKET,
      storage_path: path,
      file_name: path.split("/").at(-1) ?? key,
      provider: layerKey === "limite" ? "kml" : null,
      confidence: layerKey === "limite" ? "alta" : null,
      official_data: false,
    };
  });
}

function parseLegacyKey(key: string) {
  if (key === "pacote_resultados_zip") return { layerKey: "pacote", format: "zip" };
  if (key === "relatorio_ambiental_json" || key === "relatorio_json") return { layerKey: "relatorio", format: "json" };
  if (key === "relatorio_multifonte_json") return { layerKey: "relatorio_multifonte", format: "json" };
  if (key.endsWith("_shp_zip")) return { layerKey: key.replace(/_shp_zip$/, ""), format: "shp_zip" };
  if (key.endsWith("_geojson")) return { layerKey: key.replace(/_geojson$/, ""), format: "geojson" };
  if (key.endsWith("_kml")) return { layerKey: key.replace(/_kml$/, ""), format: "kml" };
  return { layerKey: key, format: "arquivo" };
}

function formatLayerName(layerKey: string) {
  const labels: Record<string, string> = {
    limite: "Limite da propriedade",
    vegetacao_existente: "Vegetação existente",
    vegetacao_nativa: "Vegetação nativa",
    floresta: "Floresta",
    agropecuaria: "Agropecuária",
    agua_represa: "Água/represa",
    agua: "Água",
    area_nao_vegetada: "Área não vegetada",
    drenagem_corrego: "Drenagem/córrego",
    hidrografia_oficial: "Hidrografia oficial",
    relatorio: "Relatório ambiental",
    pacote: "Pacote completo",
  };
  return labels[layerKey] || layerKey;
}

function normalizeOutputPaths(rawPaths: unknown, resultStoragePath: unknown): OutputMap {
  const outputPaths: OutputMap = {};
  if (rawPaths && typeof rawPaths === "object" && !Array.isArray(rawPaths)) {
    for (const [key, value] of Object.entries(rawPaths as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        outputPaths[key] = value;
      }
    }
  }
  if (typeof resultStoragePath === "string" && resultStoragePath.trim() && !outputPaths.relatorio_ambiental_json) {
    outputPaths.relatorio_ambiental_json = resultStoragePath;
  }
  return outputPaths;
}
