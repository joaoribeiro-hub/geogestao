import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { BUSCAGEO_BUCKET, createSignedUrl, loadBuscaGeoJobForUser } from "@/lib/modules/buscageo";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await requireOrganization(supabase, user.id);
  if (!context.organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });

  const job = await loadBuscaGeoJobForUser(supabase, context.organization.id, id);
  if (!job || typeof job.output_storage_path !== "string") {
    return NextResponse.json({ error: "Resultado nao encontrado." }, { status: 404 });
  }

  const url = await createSignedUrl(supabase, job.output_storage_path);
  if (!url) {
    return NextResponse.json({ error: `Nao foi possivel gerar signed URL no bucket ${BUSCAGEO_BUCKET}.` }, { status: 500 });
  }
  return NextResponse.redirect(url);
}
