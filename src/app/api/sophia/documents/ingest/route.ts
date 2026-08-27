import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { triggerSophiaDocumentIngestion } from "@/lib/sophia/v3/document-ingestion";

const schema = z.object({ inbox_item_id: z.string().uuid().optional(), document_id: z.string().uuid().optional() }).refine((value) => Boolean(value.inbox_item_id || value.document_id));

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe inbox_item_id ou document_id." }, { status: 400 });
  try {
    const result = await triggerSophiaDocumentIngestion({ supabase, organizationId: organization.id, userId: user.id, inboxItemId: parsed.data.inbox_item_id, documentId: parsed.data.document_id });
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel iniciar a ingestao." }, { status: 502 });
  }
}

