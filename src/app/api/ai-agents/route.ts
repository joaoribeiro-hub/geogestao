import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { membership } = await requireOrganization(supabase, user.id);
  const isOwner = membership?.role === "owner";

  const { data, error } = await supabase
    .from("ai_agents")
    .select("slug,name,description,schedule_type")
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ agents: [], error: error.message }, { status: 500 });
  const agents = isOwner ? data ?? [] : (data ?? []).filter((agent) => agent.slug !== "financeiro");
  return NextResponse.json({ agents });
}
