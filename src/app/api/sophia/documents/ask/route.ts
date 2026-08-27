import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { answerFromEvidence, retrieveDocumentEvidence } from "@/lib/sophia/v3/self-rag";

const schema = z.object({ question: z.string().trim().min(2).max(1000), document_id: z.string().uuid().optional().nullable() });

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pergunta documental invalida." }, { status: 400 });
  try {
    const evidence = await retrieveDocumentEvidence({ supabase, user, organizationId: organization.id, membership: null, isOwner: false }, { query: parsed.data.question, documentId: parsed.data.document_id, limit: 12 });
    const result = answerFromEvidence(evidence);
    return NextResponse.json({ ...result, supported: evidence.length > 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel analisar os documentos." }, { status: 500 });
  }
}

