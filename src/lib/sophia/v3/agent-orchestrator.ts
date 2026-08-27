import { runAiAgent } from "@/lib/ai-agents/runner";
import type { ServerSupabase } from "@/lib/sophia/types";

export async function runSophiaAgentPipeline(input: {
  supabase: ServerSupabase;
  organizationId: string;
  userId: string;
  isOwner: boolean;
  runDate: string;
  includeWeekly: boolean;
}) {
  const slugs = input.includeWeekly
    ? ["documentos", "revisao-semanal", ...(input.isOwner ? ["financeiro"] : [])]
    : ["documentos", "briefing-matinal"];
  const runs: Array<{ slug: string; run: Awaited<ReturnType<typeof runAiAgent>> }> = [];
  for (const slug of slugs) {
    runs.push({ slug, run: await runAiAgent({
      supabase: input.supabase,
      organizationId: input.organizationId,
      userId: input.userId,
      slug,
      isOwner: input.isOwner,
      triggerType: "cron",
      runDate: input.runDate,
    }) });
  }
  return runs;
}
