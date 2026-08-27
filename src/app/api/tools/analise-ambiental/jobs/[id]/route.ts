import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";

const jobSelect =
  "id,status,original_filename,created_at,input_size_bytes,requested_layers,area_ha,bbox,result_summary,warnings,output_storage_paths,error_message,finished_at,progress";

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
    .select(jobSelect)
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job ambiental não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ job });
}
