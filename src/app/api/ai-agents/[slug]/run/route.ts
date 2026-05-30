import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runAiAgent } from "@/lib/ai-agents/runner";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });

  try {
    const run = await runAiAgent({
      supabase,
      organizationId: organization.id,
      userId: user.id,
      slug,
      isOwner: membership?.role === "owner",
    });
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel executar o agente." },
      { status: 500 },
    );
  }
}
