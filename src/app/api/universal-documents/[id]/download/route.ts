import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const { id } = await params;
  const database = supabase as unknown as UniversalDocumentDatabase;
  const { data, error } = await database.from("universal_documents").select("id,storage_bucket,storage_path,file_name,is_active").eq("id", id).eq("is_active", true).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });
  const signed = await supabase.storage.from(data.storage_bucket).createSignedUrl(data.storage_path, 300, { download: data.file_name });
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: signed.error?.message ?? "Download indisponivel." }, { status: 500 });
  return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300 });
}

type UniversalDocumentRow = { id: string; storage_bucket: string; storage_path: string; file_name: string; is_active: boolean };
type SelectChain = { eq(column: string, value: string | boolean): SelectChain; maybeSingle(): Promise<{ data: UniversalDocumentRow | null; error: { message: string } | null }> };
type UniversalDocumentDatabase = { from(table: "universal_documents"): { select(columns: string): SelectChain } };
