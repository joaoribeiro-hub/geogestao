import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCurrentPlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const current = await getCurrentPlatformDeveloper(supabase, user);
  return NextResponse.json({
    isPlatformDeveloper: current.isPlatformDeveloper,
    role: current.developer?.role ?? null,
  });
}
