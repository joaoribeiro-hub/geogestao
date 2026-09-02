import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requirePlatformDeveloper } from "@/lib/platform/platform-auth";
import {
  buildUniversalDocumentPath,
  UNIVERSAL_CONTENT_BUCKET,
  validateUniversalFile,
} from "@/lib/platform/universal-content";
import { createServerSupabase } from "@/lib/supabase/server";

const categorySchema = z.enum(["legislacao", "anexos"]);
const createSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional().nullable(),
  category: categorySchema,
  storageBucket: z.literal(UNIVERSAL_CONTENT_BUCKET),
  storagePath: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(180).optional().nullable(),
  fileSize: z.number().int().positive(),
});

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const category = categorySchema.safeParse(new URL(request.url).searchParams.get("category"));
  if (!category.success) return NextResponse.json({ error: "Categoria invalida." }, { status: 400 });

  const database = supabase as unknown as UniversalDocumentsDatabase;
  const { data, error } = await database
    .from("universal_documents")
    .select("id,title,description,category,file_name,mime_type,file_size,published_at,created_at")
    .eq("category", category.data)
    .eq("is_active", true)
    .order("published_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message, documents: [] }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  try {
    await requirePlatformDeveloper(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados do documento invalidos." }, { status: 400 });
  const input = parsed.data;
  const fileError = validateUniversalFile({ size: input.fileSize, type: input.mimeType });
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
  const expectedPath = buildUniversalDocumentPath(input.category, input.id, input.fileName);
  if (input.storagePath !== expectedPath) return NextResponse.json({ error: "Caminho de arquivo invalido." }, { status: 400 });

  const database = supabase as unknown as UniversalDocumentsDatabase;
  const { data, error } = await database.from("universal_documents").insert({
    id: input.id,
    title: input.title,
    description: input.description || null,
    category: input.category,
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType || null,
    file_size: input.fileSize,
    created_by: user.id,
  }).select("id,title,description,category,file_name,mime_type,file_size,published_at,created_at").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}

type QueryResult = { data: Array<Record<string, unknown>> | null; error: { message: string } | null };
type UniversalQuery = PromiseLike<QueryResult> & {
  eq(column: string, value: string | boolean): UniversalQuery;
  order(column: string, options: { ascending: boolean }): UniversalQuery;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};
type UniversalDocumentsDatabase = {
  from(table: "universal_documents"): {
    select(columns: string): UniversalQuery;
    insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
  };
};
