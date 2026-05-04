import { redirect } from "next/navigation";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
}
