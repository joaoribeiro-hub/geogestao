"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser, requireOrganizationOwner } from "@/lib/organization";
import { normalizeOperationalProfile, slugifyOperationalName } from "@/lib/operational-profile";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createServiceTypeAction(name: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationOwner(supabase, organization.id, user.id);
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 80) throw new Error("Informe um nome de tipo entre 2 e 80 caracteres.");
  const { data: lastBoard } = await supabase.from("service_boards").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const slug = `${slugifyOperationalName(cleanName)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: board, error } = await supabase.from("service_boards").insert({
    name: cleanName,
    slug,
    description: "Tipo de serviço personalizado da organização.",
    position: Number(lastBoard?.position ?? 0) + 1,
    organization_id: organization.id,
    operational_profile: normalizeOperationalProfile(organization.operational_profile),
    is_active: true,
  }).select("id").maybeSingle();
  if (error || !board) throw new Error(error?.message ?? "Não foi possível criar o tipo de serviço.");
  const { error: columnError } = await supabase.from("service_columns").insert({
    board_id: board.id,
    name: "Em andamento",
    slug: `em-andamento-${crypto.randomUUID().slice(0, 8)}`,
    position: 1,
    is_active: true,
  });
  if (columnError) throw new Error(columnError.message);
  revalidatePath("/servicos");
  return { ok: true, boardId: board.id };
}

export async function deactivateServiceTypeAction(boardId: string, fallbackBoardId?: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationOwner(supabase, organization.id, user.id);
  const { data: board, error: boardError } = await supabase.from("service_boards").select("id,organization_id,is_active").eq("id", boardId).maybeSingle();
  if (boardError) throw new Error(boardError.message);
  if (!board) throw new Error("Tipo de serviço não encontrado.");
  if (!board.organization_id) {
    const { error: settingsError } = await supabase.from("organization_service_board_settings").upsert({
      organization_id: organization.id,
      board_id: boardId,
      is_visible: false,
      position: 9999,
    }, { onConflict: "organization_id,board_id" });
    if (settingsError) throw new Error(settingsError.message);
    revalidatePath("/servicos");
    return { ok: true, hiddenForOrganization: true };
  }
  if (board.organization_id !== organization.id) throw new Error("Este tipo pertence a outra organização.");
  const { data: columns } = await supabase.from("service_columns").select("id").eq("board_id", boardId);
  const columnIds = (columns ?? []).map((item) => item.id);
  if (columnIds.length) {
    const { data: cards } = await supabase.from("service_cards").select("id").eq("organization_id", organization.id).in("column_id", columnIds);
    if ((cards ?? []).length && !fallbackBoardId) throw new Error("Mova os serviços para outro tipo antes de desativar este tipo.");
    if ((cards ?? []).length && fallbackBoardId) {
      const { data: fallbackColumns } = await supabase.from("service_columns").select("id").eq("board_id", fallbackBoardId).eq("is_active", true).order("position").limit(1);
      const fallbackColumnId = fallbackColumns?.[0]?.id;
      if (!fallbackColumnId) throw new Error("Tipo de destino sem etapa ativa.");
      await supabase.from("service_cards").update({ column_id: fallbackColumnId }).eq("organization_id", organization.id).in("column_id", columnIds);
    }
  }
  const { error } = await supabase.from("service_boards").update({ is_active: false }).eq("id", boardId).eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/servicos");
  return { ok: true };
}

export async function createServiceColumnAction(boardId: string, name: string, position?: number) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationOwner(supabase, organization.id, user.id);
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 80) throw new Error("Informe um nome de etapa entre 2 e 80 caracteres.");
  const { data: board } = await supabase.from("service_boards").select("id").eq("id", boardId).maybeSingle();
  if (!board) throw new Error("Tipo de serviço não encontrado.");
  const { data: columns } = await supabase.from("service_columns").select("id,position").eq("board_id", boardId).eq("is_active", true).order("position");
  const insertPosition = Math.max(1, Math.min(Number(position ?? (columns?.length ?? 0) + 1), (columns?.length ?? 0) + 1));
  const { error } = await supabase.from("service_columns").insert({ organization_id: organization.id, board_id: boardId, name: cleanName, slug: `${slugifyOperationalName(cleanName)}-${crypto.randomUUID().slice(0, 8)}`, position: insertPosition, is_active: true });
  if (error) throw new Error(error.message);
  revalidatePath("/servicos");
  return { ok: true };
}

export async function deactivateServiceColumnAction(columnId: string, fallbackColumnId?: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationOwner(supabase, organization.id, user.id);
  const { data: column } = await supabase.from("service_columns").select("id,board_id,organization_id").eq("id", columnId).maybeSingle();
  if (!column) throw new Error("Etapa não encontrada.");
  const { data: cards } = await supabase.from("service_cards").select("id").eq("organization_id", organization.id).eq("column_id", columnId);
  if ((cards ?? []).length && !fallbackColumnId) throw new Error("Mova os serviços desta etapa antes de desativá-la.");
  if ((cards ?? []).length && fallbackColumnId) await supabase.from("service_cards").update({ column_id: fallbackColumnId }).eq("organization_id", organization.id).eq("column_id", columnId);
  if (!column.organization_id) {
    const { error: settingsError } = await supabase.from("organization_service_column_settings").upsert({ organization_id: organization.id, column_id: columnId, is_visible: false, position: 9999 }, { onConflict: "organization_id,column_id" });
    if (settingsError) throw new Error(settingsError.message);
    revalidatePath("/servicos");
    return { ok: true, hiddenForOrganization: true };
  }
  if (column.organization_id !== organization.id) throw new Error("Esta etapa pertence a outra organização.");
  const { error } = await supabase.from("service_columns").update({ is_active: false }).eq("id", columnId).eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/servicos");
  return { ok: true };
}

export async function reorderServiceColumnsAction(boardId: string, columnIds: string[]) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationOwner(supabase, organization.id, user.id);
  for (const [index, columnId] of columnIds.entries()) {
    await supabase.from("organization_service_column_settings").upsert({ organization_id: organization.id, column_id: columnId, position: index + 1, is_visible: true }, { onConflict: "organization_id,column_id" });
  }
  revalidatePath("/servicos");
  return { ok: true };
}

export async function reorderServiceBoardsAction(boardIds: string[]) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationOwner(supabase, organization.id, user.id);
  for (const [index, boardId] of boardIds.entries()) {
    await supabase.from("organization_service_board_settings").upsert({ organization_id: organization.id, board_id: boardId, position: index + 1, is_visible: true }, { onConflict: "organization_id,board_id" });
  }
  revalidatePath("/servicos");
  return { ok: true };
}
