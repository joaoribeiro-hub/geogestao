import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type PlatformDeveloper = {
  id: string;
  user_id: string;
  email: string | null;
  role: "developer" | "platform_admin";
  is_active: boolean;
};

export async function isPlatformDeveloper(
  supabase: ServerSupabase,
  userId: string,
  email?: string | null,
) {
  const database = supabase as unknown as PlatformDatabase;
  const { data, error } = await database
    .from("platform_developers")
    .select("id,user_id,email,role,is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!error && data) return true;
  return isConfiguredLocalDeveloper(email);
}

export async function getCurrentPlatformDeveloper(
  supabase: ServerSupabase,
  existingUser?: User,
) {
  const user = existingUser ?? await requireUser(supabase);
  const database = supabase as unknown as PlatformDatabase;
  const { data, error } = await database
    .from("platform_developers")
    .select("id,user_id,email,role,is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const envFallback = isConfiguredLocalDeveloper(user.email);
  return {
    user,
    isPlatformDeveloper: Boolean(data) || envFallback,
    developer: data ?? null,
    source: data ? "database" as const : envFallback ? "environment" as const : null,
    migrationPending: Boolean(error),
  };
}

export async function requirePlatformDeveloper(
  supabase: ServerSupabase,
  existingUser?: User,
) {
  const current = await getCurrentPlatformDeveloper(supabase, existingUser);
  if (!current.isPlatformDeveloper) {
    throw new PlatformDeveloperAccessError();
  }
  return current;
}

export class PlatformDeveloperAccessError extends Error {
  status = 403;

  constructor() {
    super("Acesso restrito ao desenvolvedor da plataforma.");
    this.name = "PlatformDeveloperAccessError";
  }
}

function isConfiguredLocalDeveloper(email?: string | null) {
  if (!email || process.env.NODE_ENV === "production") return false;
  const configured = (process.env.PLATFORM_DEVELOPER_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}

type PlatformQuery = {
  eq(column: string, value: string | boolean): PlatformQuery;
  maybeSingle(): Promise<{ data: PlatformDeveloper | null; error: { message: string } | null }>;
};
type PlatformDatabase = {
  from(table: "platform_developers"): {
    select(columns: string): PlatformQuery;
  };
};
