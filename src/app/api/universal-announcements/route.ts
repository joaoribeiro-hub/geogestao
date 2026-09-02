import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requirePlatformDeveloper } from "@/lib/platform/platform-auth";
import {
  buildUniversalAnnouncementPath,
  UNIVERSAL_CONTENT_BUCKET,
  validateUniversalFile,
} from "@/lib/platform/universal-content";
import { createServerSupabase } from "@/lib/supabase/server";

const createSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(8000),
  attachment: z.object({
    bucket: z.literal(UNIVERSAL_CONTENT_BUCKET),
    path: z.string().min(1).max(500),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().max(180).optional().nullable(),
    size: z.number().int().positive(),
  }).optional().nullable(),
});

export async function GET() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const database = supabase as unknown as UniversalAnnouncementsDatabase;
  const readsDatabase = supabase as unknown as UniversalReadsDatabase;
  const { data, error } = await database.from("universal_announcements").select("id,title,body,attachment_file_name,attachment_mime_type,starts_at,ends_at,created_at").eq("is_active", true).order("starts_at", { ascending: false });
  if (error) return NextResponse.json({ announcements: [], error: error.message }, { status: 500 });
  const ids = (data ?? []).map((item) => item.id);
  const reads = ids.length
    ? await readsDatabase.from("universal_announcement_reads").select("announcement_id,read_at").eq("user_id", user.id).in("announcement_id", ids)
    : { data: [], error: null };
  const readMap = new Map((reads.data ?? []).map((item) => [item.announcement_id, item.read_at]));
  return NextResponse.json({ announcements: (data ?? []).map((item) => ({ ...item, read_at: readMap.get(item.id) ?? null })) });
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
  if (!parsed.success) return NextResponse.json({ error: "Dados do aviso invalidos." }, { status: 400 });
  const input = parsed.data;
  if (input.attachment) {
    const fileError = validateUniversalFile({ size: input.attachment.size, type: input.attachment.mimeType });
    if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
    const expectedPath = buildUniversalAnnouncementPath(input.id, input.attachment.fileName);
    if (input.attachment.path !== expectedPath) return NextResponse.json({ error: "Caminho de anexo invalido." }, { status: 400 });
  }
  const database = supabase as unknown as UniversalAnnouncementsDatabase;
  const { data, error } = await database.from("universal_announcements").insert({
    id: input.id,
    title: input.title,
    body: input.body,
    attachment_bucket: input.attachment?.bucket ?? null,
    attachment_path: input.attachment?.path ?? null,
    attachment_file_name: input.attachment?.fileName ?? null,
    attachment_mime_type: input.attachment?.mimeType ?? null,
    attachment_size: input.attachment?.size ?? null,
    created_by: user.id,
  }).select("id,title,body,attachment_file_name,attachment_mime_type,starts_at,created_at").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data }, { status: 201 });
}

type AnnouncementRow = { id: string; title: string; body: string; attachment_file_name: string | null; attachment_mime_type: string | null; starts_at: string; ends_at: string | null; created_at: string };
type ReadRow = { announcement_id: string; read_at: string };
type AnnouncementQuery = PromiseLike<{ data: AnnouncementRow[] | null; error: { message: string } | null }> & { eq(column: string, value: string | boolean): AnnouncementQuery; order(column: string, options: { ascending: boolean }): AnnouncementQuery };
type ReadQuery = PromiseLike<{ data: ReadRow[] | null; error: { message: string } | null }> & { eq(column: string, value: string): ReadQuery; in(column: string, values: string[]): ReadQuery };
type UniversalAnnouncementsDatabase = { from(table: "universal_announcements"): { select(columns: string): AnnouncementQuery; insert(value: Record<string, unknown>): { select(columns: string): { maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } } } };
type UniversalReadsDatabase = { from(table: "universal_announcement_reads"): { select(columns: string): ReadQuery } };
