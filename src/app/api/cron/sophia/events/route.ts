import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { processPendingSophiaEvents } from "@/lib/sophia/v3/event-processor";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : headerSecret;
  if (!secret || token !== secret) return NextResponse.json({ error: "Cron nao autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await processPendingSophiaEvents(createAdminSupabase()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel processar eventos." }, { status: 500 });
  }
}

