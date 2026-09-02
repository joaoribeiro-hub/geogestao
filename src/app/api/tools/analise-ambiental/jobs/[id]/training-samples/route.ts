import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";

const allowedClasses = new Set(["vegetacao", "agropecuaria", "agua", "solo_exposto", "outro", "divergencia"]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await context.params;
  const auth = await authorizedContext();
  if (auth instanceof NextResponse) return auth;
  const { db, organizationId } = auth;
  const { data, error } = await db
    .from("environmental_training_samples")
    .select("id,job_id,source_layer,final_class,label_source,confidence_score,confidence_tier,validation_status,corrected_class,notes,validated_at,metadata")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ samples: data ?? [] });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await context.params;
  const auth = await authorizedContext();
  if (auth instanceof NextResponse) return auth;
  const { db, organizationId, userId } = auth;
  const body = (await request.json()) as { sampleId?: string; action?: string; correctedClass?: string; notes?: string };
  if (!body.sampleId || !["approve", "correct", "dispute", "reject"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "Ação de validação inválida." }, { status: 400 });
  }
  if (body.action === "correct" && !allowedClasses.has(body.correctedClass ?? "")) {
    return NextResponse.json({ error: "Classe corrigida inválida." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const payload = body.action === "approve"
    ? { validation_status: "approved", label_source: "user_validated", confidence_tier: "GOLD", validated_by: userId, validated_at: now, notes: body.notes ?? null, updated_at: now }
    : body.action === "correct"
      ? { validation_status: "corrected", label_source: "user_corrected", corrected_class: body.correctedClass, confidence_tier: "GOLD", validated_by: userId, validated_at: now, notes: body.notes ?? null, updated_at: now }
      : body.action === "dispute"
        ? { validation_status: "candidate", confidence_tier: "DISPUTED", validated_by: userId, validated_at: now, notes: body.notes ?? null, updated_at: now }
        : { validation_status: "rejected", validated_by: userId, validated_at: now, notes: body.notes ?? null, updated_at: now };
  const { data, error } = await db
    .from("environmental_training_samples")
    .update(payload)
    .eq("id", body.sampleId)
    .eq("job_id", jobId)
    .eq("organization_id", organizationId)
    .select("id,source_layer,final_class,confidence_tier,validation_status,corrected_class,validated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!data) return NextResponse.json({ error: "Amostra não encontrada ou sem permissão para editar." }, { status: 404 });
  return NextResponse.json({ sample: data });
}

async function authorizedContext() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 403 });
  }
  return { db: asUntypedSupabase(supabase), organizationId: context.organization.id, userId: user.id };
}
