import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

type InsertClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function insertModuleJob(
  supabase: ServerSupabase,
  table: string,
  values: Record<string, unknown>,
) {
  const { data, error } = await (supabase as unknown as InsertClient)
    .from(table)
    .insert(values)
    .select("id")
    .single();

  if (error) {
    if (/schema cache|does not exist|Could not find/i.test(error.message)) {
      return { id: crypto.randomUUID(), persisted: false, warning: "Migration do modulo ainda nao aplicada." };
    }
    throw new Error(error.message);
  }

  return { id: data?.id ?? crypto.randomUUID(), persisted: true, warning: null };
}

export async function tryUploadModuleText({
  supabase,
  path,
  content,
  contentType,
}: {
  supabase: ServerSupabase;
  path: string;
  content: string | Blob;
  contentType: string;
}) {
  const { error } = await supabase.storage.from("documentos").upload(path, content, {
    contentType,
    upsert: true,
  });
  if (error) return { path: null, warning: "Storage documentos indisponivel ou policy ainda nao aplicada." };
  return { path, warning: null };
}
