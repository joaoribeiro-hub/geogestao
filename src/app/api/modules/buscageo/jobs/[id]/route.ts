import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadBuscaGeoJobForUser, mapBuscaGeoJob } from "@/lib/modules/buscageo";
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
  if (!job) return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });
  return NextResponse.json(await mapBuscaGeoJob(supabase, job));
}
