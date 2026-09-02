import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { id } = await params;
  const database = supabase as unknown as AnnouncementReadDatabase;
  const visible = await database.from("universal_announcements").select("id").eq("id", id).eq("is_active", true).maybeSingle();
  if (visible.error || !visible.data) return NextResponse.json({ error: "Aviso nao encontrado." }, { status: 404 });
  const read = await database.from("universal_announcement_reads").upsert({ announcement_id: id, user_id: user.id, read_at: new Date().toISOString() }, { onConflict: "announcement_id,user_id" });
  if (read.error) return NextResponse.json({ error: read.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

type SelectChain = { eq(column: string, value: string | boolean): SelectChain; maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }> };
type AnnouncementReadDatabase = { from(table: string): { select(columns: string): SelectChain; upsert(value: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: { message: string } | null }> } };
