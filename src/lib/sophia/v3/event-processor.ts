import type { createAdminSupabase } from "@/lib/supabase/admin";

type AdminSupabase = ReturnType<typeof createAdminSupabase>;

export async function processPendingSophiaEvents(supabase: AdminSupabase, limit = 100) {
  const db = supabase as unknown as EventSupabase;
  const { data: events, error } = await db.from("sophia_events").select("id,organization_id,user_id,event_type,entity_type,entity_id,payload").eq("status", "pending").order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message);
  let processed = 0;
  let failed = 0;
  for (const event of events ?? []) {
    try {
      await db.from("sophia_events").update({ status: "processing" }).eq("id", event.id);
      await db.from("sophia_memories").insert({
        organization_id: event.organization_id,
        user_id: event.user_id,
        scope: "company",
        memory_type: "episodic",
        title: `Evento operacional: ${event.event_type}`,
        content: formatEvent(event),
        metadata: { event_id: event.id, entity_type: event.entity_type, entity_id: event.entity_id, payload: event.payload },
        importance: 1,
        source: "sophia_event_processor",
        created_by: event.user_id,
      });
      await db.from("sophia_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", event.id);
      processed += 1;
    } catch {
      await db.from("sophia_events").update({ status: "failed" }).eq("id", event.id);
      failed += 1;
    }
  }
  return { received: events?.length ?? 0, processed, failed };
}

function formatEvent(event: EventRow) {
  const payload = event.payload && typeof event.payload === "object" ? JSON.stringify(event.payload).slice(0, 1400) : "{}";
  return `${event.event_type}${event.entity_type ? ` em ${event.entity_type}` : ""}${event.entity_id ? ` (${event.entity_id})` : ""}. Dados: ${payload}`;
}

type EventRow = { id: string; organization_id: string; user_id?: string | null; event_type: string; entity_type?: string | null; entity_id?: string | null; payload: unknown };
type EventQuery = PromiseLike<{ data: EventRow[] | null; error: { message: string } | null }> & { eq(column: string, value: string): EventQuery; order(column: string, options: { ascending: boolean }): EventQuery; limit(value: number): EventQuery };
type EventTable = { select(columns: string): EventQuery; update(value: Record<string, unknown>): { eq(column: string, value: string): Promise<{ error: { message: string } | null }> }; insert(value: Record<string, unknown>): Promise<{ error: { message: string } | null }> };
type EventSupabase = { from(table: string): EventTable };

