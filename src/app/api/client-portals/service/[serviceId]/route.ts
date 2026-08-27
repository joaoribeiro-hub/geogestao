import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const organization = context.organization;
  if (!organization || !context.membership) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 403 });
  }

  const { data: service, error: serviceError } = await supabase
    .from("service_cards")
    .select("id,organization_id,client_id,title,description,checklist_percent")
    .eq("id", serviceId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }

  if (!service) {
    return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404 });
  }

  const db = asUntypedSupabase(supabase);
  const { data: portal, error: portalError } = await db
    .from("client_portals")
    .upsert(
      {
        organization_id: organization.id,
        service_card_id: service.id,
        client_id: service.client_id,
        is_active: true,
        public_title: service.title,
        public_summary: service.description,
        progress_override: Math.round(Number(service.checklist_percent ?? 0)),
        last_published_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,service_card_id" },
    )
    .select("id")
    .single();

  if (portalError) {
    return NextResponse.json({ error: portalError.message }, { status: 500 });
  }

  if (!portal) {
    return NextResponse.json({ error: "Portal não foi criado." }, { status: 500 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashPortalToken(token);
  const { error: linkError } = await db.from("client_portal_links").insert({
    organization_id: organization.id,
    portal_id: portal.id,
    token_hash: tokenHash,
    label: "Link principal",
    access_mode: "private_link",
    created_by: user.id,
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  await db.from("client_portal_updates").insert({
    organization_id: organization.id,
    portal_id: portal.id,
    title: "Portal publicado",
    summary: "O acompanhamento do serviço foi disponibilizado para visualização do cliente.",
    update_type: "portal_published",
    created_by: user.id,
  });

  return NextResponse.json({
    portalId: portal.id,
    publicUrl: buildPublicPortalUrl(await headers(), token),
  });
}

function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPublicPortalUrl(headerStore: Headers, token: string) {
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/p/${token}`;
}
