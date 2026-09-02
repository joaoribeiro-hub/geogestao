import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const { id } = await params;
  const database = supabase as unknown as AnnouncementDatabase;
  const { data, error } = await database.from("universal_announcements").select("id,attachment_bucket,attachment_path,attachment_file_name,is_active").eq("id", id).eq("is_active", true).maybeSingle();
  if (error || !data?.attachment_bucket || !data.attachment_path) return NextResponse.json({ error: "Anexo nao encontrado." }, { status: 404 });
  const signed = await supabase.storage.from(data.attachment_bucket).createSignedUrl(data.attachment_path, 300, { download: data.attachment_file_name ?? true });
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: signed.error?.message ?? "Download indisponivel." }, { status: 500 });
  return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300 });
}

type Row = { id: string; attachment_bucket: string | null; attachment_path: string | null; attachment_file_name: string | null; is_active: boolean };
type SelectChain = { eq(column: string, value: string | boolean): SelectChain; maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }> };
type AnnouncementDatabase = { from(table: "universal_announcements"): { select(columns: string): SelectChain } };
