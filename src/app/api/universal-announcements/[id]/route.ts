import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  try { await requirePlatformDeveloper(supabase, user); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }
  const { id } = await params;
  const database = supabase as unknown as AnnouncementDatabase;
  const existing = await database.from("universal_announcements").select("id,attachment_bucket,attachment_path").eq("id", id).maybeSingle();
  if (existing.error || !existing.data) return NextResponse.json({ error: "Aviso nao encontrado." }, { status: 404 });
  if (existing.data.attachment_bucket && existing.data.attachment_path) {
    const removedFile = await supabase.storage.from(existing.data.attachment_bucket).remove([existing.data.attachment_path]);
    if (removedFile.error) return NextResponse.json({ error: removedFile.error.message }, { status: 500 });
  }
  const removed = await database.from("universal_announcements").delete().eq("id", id);
  if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

type Row = { id: string; attachment_bucket: string | null; attachment_path: string | null };
type SelectChain = { eq(column: string, value: string): { maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }> } };
type DeleteChain = { eq(column: string, value: string): Promise<{ error: { message: string } | null }> };
type AnnouncementDatabase = { from(table: "universal_announcements"): { select(columns: string): SelectChain; delete(): DeleteChain } };
