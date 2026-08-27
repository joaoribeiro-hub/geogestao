import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { runSophiaAgentPipeline } from "@/lib/sophia/v3/agent-orchestrator";

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : headerSecret;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Cron nao autorizado." }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  const today = dateInBrazil(new Date());
  const weekday = weekdayInBrazil(new Date());

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id,status")
    .in("status", ["active", "trialing"]);
  if (organizationsError) {
    return NextResponse.json({ error: organizationsError.message }, { status: 500 });
  }

  const results: Array<{ organizationId: string; userId: string; briefing: string; weekly?: string }> = [];
  for (const organization of organizations ?? []) {
    const { data: members, error: membersError } = await supabase
      .from("organization_members")
      .select("user_id,role,status")
      .eq("organization_id", organization.id)
      .eq("status", "active");
    if (membersError) {
      results.push({ organizationId: organization.id, userId: "organization", briefing: `error:${membersError.message}` });
      continue;
    }

    for (const member of members ?? []) {
      const isOwner = member.role === "owner";
      try {
        const pipeline = await runSophiaAgentPipeline({
          supabase,
          organizationId: organization.id,
          userId: member.user_id,
          isOwner,
          runDate: today,
          includeWeekly: weekday === 1,
        });
        const briefing = pipeline.find((item) => item.slug === "briefing-matinal")?.run;
        const result: { organizationId: string; userId: string; briefing: string; weekly?: string } = {
          organizationId: organization.id,
          userId: member.user_id,
          briefing: briefing?.status ?? "completed",
        };
        const weekly = pipeline.find((item) => item.slug === "revisao-semanal")?.run;
        if (weekly) result.weekly = weekly.status;

        results.push(result);
      } catch (error) {
        results.push({
          organizationId: organization.id,
          userId: member.user_id,
          briefing: error instanceof Error ? `error:${error.message}` : "error",
        });
      }
    }
  }

  return NextResponse.json({ date: today, results });
}

function dateInBrazil(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function weekdayInBrazil(date: Date) {
  const key = dateInBrazil(date);
  return new Date(`${key}T00:00:00-03:00`).getDay();
}
