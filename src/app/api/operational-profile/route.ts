import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext, canManageOrganization } from "@/lib/organization";
import { normalizeOperationalProfile } from "@/lib/operational-profile";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({ profile: z.enum(["padrao", "agrimensura", "arquitetura"]) });

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) {
    return NextResponse.json({ error: "Usuário sem organização ativa." }, { status: 403 });
  }
  if (!canManageOrganization({ profile: context.profile, membership: context.membership })) {
    return NextResponse.json({ error: "Apenas o owner pode alterar o perfil operacional." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Perfil operacional inválido." }, { status: 400 });
  const { error } = await supabase
    .from("organizations")
    .update({ operational_profile: normalizeOperationalProfile(parsed.data.profile) })
    .eq("id", context.organization.id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar o perfil operacional." }, { status: 500 });
  return NextResponse.json({ ok: true, profile: parsed.data.profile });
}
