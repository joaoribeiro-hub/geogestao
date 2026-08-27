import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";
import { requestEnvironmentalWorkerProcess } from "@/lib/tools/analise-ambiental/worker";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id,organization_id,status")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job ambiental não encontrado." }, { status: 404 });
  }

  const result = await requestEnvironmentalWorkerProcess(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status ?? 503 });
  }

  return NextResponse.json({ message: result.message });
}
