"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function createBrowserSupabase() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
