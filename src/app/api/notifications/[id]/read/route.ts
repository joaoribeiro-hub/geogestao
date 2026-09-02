import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (id.startsWith("universal:")) {
    const announcementId = id.slice("universal:".length);
    const database = supabase as unknown as UniversalReadDatabase;
    const visible = await database.from("universal_announcements").select("id").eq("id", announcementId).eq("is_active", true).maybeSingle();
    if (visible.error || !visible.data) return NextResponse.json({ ok: false, error: "Aviso nao encontrado." }, { status: 404 });
    const read = await database.from("universal_announcement_reads").upsert({ announcement_id: announcementId, user_id: user.id, read_at: new Date().toISOString() }, { onConflict: "announcement_id,user_id" });
    if (read.error) return NextResponse.json({ ok: false, error: read.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .eq("recipient_user_id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

type UniversalSelectChain = { eq(column: string, value: string | boolean): UniversalSelectChain; maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }> };
type UniversalReadDatabase = { from(table: string): { select(columns: string): UniversalSelectChain; upsert(value: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: { message: string } | null }> } };
