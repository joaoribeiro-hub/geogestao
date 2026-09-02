import JSZip from "jszip";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";

type TrainingSample = {
  id: string;
  job_id: string;
  source_layer: string;
  final_class: string;
  geometry: unknown;
  raster_storage_path: string | null;
  aoi_storage_path: string | null;
  label_source: string;
  confidence_score: number;
  confidence_tier: string;
  validation_status: string;
  corrected_class: string | null;
  notes: string | null;
  created_at: string;
  validated_at: string | null;
  metadata: Record<string, unknown> | null;
};

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 403 });
  }
  const db = asUntypedSupabase(supabase);
  const { data, error } = await db
    .from<TrainingSample>("environmental_training_samples")
    .select("id,job_id,source_layer,final_class,geometry,raster_storage_path,aoi_storage_path,label_source,confidence_score,confidence_tier,validation_status,corrected_class,notes,created_at,validated_at,metadata")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const samples = (data ?? []).filter((sample) => sample.validation_status !== "rejected");
  const counts = (tier: string) => samples.filter((sample) => sample.confidence_tier === tier).length;
  const manifest = {
    dataset_version: "v0.1",
    generated_at: new Date().toISOString(),
    classes: ["vegetacao", "agropecuaria", "agua", "solo_exposto", "outro"],
    samples_total: samples.length,
    gold: counts("GOLD"),
    silver: counts("SILVER"),
    bronze: counts("BRONZE"),
    disputed: counts("DISPUTED"),
  };
  const labels = {
    type: "FeatureCollection",
    features: samples.filter((sample) => sample.geometry).map((sample) => ({
      type: "Feature",
      id: sample.id,
      geometry: sample.geometry,
      properties: {
        job_id: sample.job_id,
        source_layer: sample.source_layer,
        class: sample.corrected_class || sample.final_class,
        label_source: sample.label_source,
        confidence_score: sample.confidence_score,
        confidence_tier: sample.confidence_tier,
        validation_status: sample.validation_status,
      },
    })),
  };
  const rasterIndex = samples.map((sample) => ({ id: sample.id, raster_storage_path: sample.raster_storage_path, aoi_storage_path: sample.aoi_storage_path }));
  const zip = new JSZip();
  zip.file("labels.geojson", JSON.stringify(labels, null, 2));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("raster_index.json", JSON.stringify(rasterIndex, null, 2));
  zip.file("metadata.json", JSON.stringify({ organization_id: context.organization.id, samples }, null, 2));
  const content = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const body = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="geogestao-vegetation-dataset-v0.1.zip"',
      "Cache-Control": "private, no-store",
    },
  });
}
