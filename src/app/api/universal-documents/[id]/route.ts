import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requirePlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  try {
    await requirePlatformDeveloper(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  const { id } = await params;
  const database = supabase as unknown as UniversalDocumentDatabase;
  const updated = await database.from("universal_documents").update({ title: parsed.data.title, description: parsed.data.description || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  try {
    await requirePlatformDeveloper(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }
  const { id } = await params;
  const database = supabase as unknown as UniversalDocumentDatabase;
  const existing = await database.from("universal_documents").select("id,storage_bucket,storage_path").eq("id", id).maybeSingle();
  if (existing.error || !existing.data) return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });

  const storage = await supabase.storage.from(existing.data.storage_bucket).remove([existing.data.storage_path]);
  if (storage.error) return NextResponse.json({ error: storage.error.message }, { status: 500 });
  const removed = await database.from("universal_documents").delete().eq("id", id);
  if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

type UniversalDocumentRow = { id: string; storage_bucket: string; storage_path: string };
type SelectChain = { eq(column: string, value: string): { maybeSingle(): Promise<{ data: UniversalDocumentRow | null; error: { message: string } | null }> } };
type DeleteChain = { eq(column: string, value: string): Promise<{ error: { message: string } | null }> };
type UniversalDocumentDatabase = { from(table: "universal_documents"): { select(columns: string): SelectChain; delete(): DeleteChain; update(value: Record<string, unknown>): DeleteChain } };
