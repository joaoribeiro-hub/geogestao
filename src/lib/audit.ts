import type { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export async function logAudit(
  supabase: ServerSupabase,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Json;
  },
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("audit_logs").insert({
    actor_id: user?.id ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}
