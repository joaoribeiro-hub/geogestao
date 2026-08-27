import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ jobs: [] }, { status: 403 });
  const db = supabase as unknown as JobsSupabase;
  const { data, error } = await db.from("sophia_document_ingestion_jobs").select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ jobs: [], error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

type JobQuery = PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & { eq(column: string, value: string): JobQuery; order(column: string, options: { ascending: boolean }): JobQuery; limit(value: number): JobQuery };
type JobsSupabase = { from(table: string): { select(columns: string): JobQuery } };

