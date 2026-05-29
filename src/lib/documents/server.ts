import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export async function assertDocumentRelatedRecords({
  supabase,
  organizationId,
  clientId,
  serviceId,
  employeeId,
}: {
  supabase: ServerSupabase;
  organizationId: string;
  clientId?: string | null;
  serviceId?: string | null;
  employeeId?: string | null;
}) {
  if (clientId) {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Cliente nao encontrado na organizacao atual.");
  }

  if (serviceId) {
    const { data, error } = await supabase
      .from("service_cards")
      .select("id")
      .eq("id", serviceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Servico nao encontrado na organizacao atual.");
  }

  if (employeeId) {
    const { data, error } = await supabase
      .from("team_members")
      .select("id")
      .eq("id", employeeId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Colaborador nao encontrado na organizacao atual.");
  }
}

export async function reserveDocumentStorageOrThrow(
  supabase: ServerSupabase,
  organizationId: string,
  sizeBytes: number,
) {
  const { data, error } = await supabase.rpc("reserve_document_storage", {
    p_organization_id: organizationId,
    p_size_bytes: sizeBytes,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sua empresa atingiu o limite de armazenamento do plano atual.");
}

export async function confirmDocumentStorage(
  supabase: ServerSupabase,
  organizationId: string,
  sizeBytes: number,
) {
  const { error } = await supabase.rpc("confirm_document_storage", {
    p_organization_id: organizationId,
    p_size_bytes: sizeBytes,
  });
  if (error) throw new Error(error.message);
}

export async function releaseDocumentStorage(
  supabase: ServerSupabase,
  organizationId: string,
  sizeBytes: number,
) {
  const { error } = await supabase.rpc("release_document_storage", {
    p_organization_id: organizationId,
    p_size_bytes: sizeBytes,
  });
  if (error) throw new Error(error.message);
}

export async function removeDocumentStorage(
  supabase: ServerSupabase,
  organizationId: string,
  sizeBytes: number,
) {
  const { error } = await supabase.rpc("remove_document_storage", {
    p_organization_id: organizationId,
    p_size_bytes: sizeBytes,
  });
  if (error) throw new Error(error.message);
}

