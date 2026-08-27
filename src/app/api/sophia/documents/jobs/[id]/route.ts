import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const { id } = await params;
  const db = supabase as unknown as JobSupabase;
  const { data, error } = await db.from("sophia_document_ingestion_jobs").select("*").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Job documental nao encontrado." }, { status: 404 });
  return NextResponse.json({ job: data });
}

type JobChain = PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }> & { eq(column: string, value: string): JobChain; maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> };
type JobSupabase = { from(table: string): { select(columns: string): JobChain } };

