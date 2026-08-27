import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { retrieveDocumentEvidence } from "@/lib/sophia/v3/self-rag";

const schema = z.object({ query: z.string().trim().max(500).optional().default(""), document_id: z.string().uuid().optional().nullable(), limit: z.number().int().min(1).max(30).optional() });

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Busca documental invalida." }, { status: 400 });
  try {
    const evidence = await retrieveDocumentEvidence({ supabase, user, organizationId: organization.id, membership: null, isOwner: false }, { query: parsed.data.query, documentId: parsed.data.document_id, limit: parsed.data.limit });
    return NextResponse.json({ evidence, supported: evidence.length > 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel buscar documentos." }, { status: 500 });
  }
}

