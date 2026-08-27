import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { triggerSophiaDocumentIngestion } from "@/lib/sophia/v3/document-ingestion";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const { id } = await params;

  const { data: item, error: itemError } = await (supabase as unknown as UntypedSupabase)
    .from("sophia_inbox_items")
    .select("id,organization_id,user_id,status")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: "Arquivo nao encontrado na organizacao atual." }, { status: 404 });
  if (item.status === "processing") return NextResponse.json({ accepted: true, status: "processing" });

  await (supabase as unknown as UntypedSupabase).from("sophia_inbox_items").update({ status: "processing", error_message: null }).eq("id", id);
  try {
    const result = await triggerSophiaDocumentIngestion({ supabase, organizationId: organization.id, userId: user.id, inboxItemId: id });
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker documental indisponivel.";
    await (supabase as unknown as UntypedSupabase).from("sophia_inbox_items").update({ status: "failed", error_message: message }).eq("id", id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

type UntypedSupabase = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: { id: string; organization_id: string; user_id: string; status: string } | null; error: { message: string } | null }>;
        };
      };
    };
    update(values: Record<string, unknown>): { eq(column: string, value: string): Promise<{ error: { message: string } | null }> };
  };
};
