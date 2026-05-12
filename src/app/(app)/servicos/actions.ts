"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import {
  checklistItemSchema,
  checklistSchema,
  serviceCardSchema,
} from "@/lib/schemas";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { revertServiceToProposal as revertServiceToProposalAction } from "@/app/(app)/propostas/actions";

export async function revertServiceToProposal(cardId: string) {
  return revertServiceToProposalAction(cardId);
}

export async function createServiceCardAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = serviceCardSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("service_cards")
    .insert({
      ...parsed,
      organization_id: organization.id,
      service_type: parsed.service_type ?? null,
      payment_status: parsed.payment_status ?? "pagamento_nao_efetuado",
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    action: "service_card.created",
    entityType: "service_card",
    entityId: data.id,
  });

  revalidatePath("/servicos");
}

export async function moveServiceCardAction(cardId: string, toColumnId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);

  const { data: current, error: currentError } = await supabase
    .from("service_cards")
    .select("column_id")
    .eq("id", cardId)
    .single();
  if (currentError) throw new Error(currentError.message);

  const { error } = await supabase
    .from("service_cards")
    .update({ column_id: toColumnId })
    .eq("id", cardId);
  if (error) throw new Error(error.message);

  await supabase.from("service_card_movements").insert({
    service_card_id: cardId,
    from_column_id: current.column_id,
    to_column_id: toColumnId,
    moved_by: user.id,
  });

  await logAudit(supabase, {
    action: "service_card.moved",
    entityType: "service_card",
    entityId: cardId,
    metadata: { from_column_id: current.column_id, to_column_id: toColumnId },
  });

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${cardId}`);
}

export async function createChecklistAction(formData: FormData) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const parsed = checklistSchema.parse(formDataToObject(formData));

  const { error } = await supabase.from("checklists").insert(parsed);
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "checklist.created",
    entityType: "service_card",
    entityId: parsed.service_card_id,
  });

  revalidatePath(`/servicos/${parsed.service_card_id}`);
}

export async function createChecklistItemAction(formData: FormData) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const parsed = checklistItemSchema.parse(formDataToObject(formData));

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("service_card_id")
    .eq("id", parsed.checklist_id)
    .single();
  if (checklistError) throw new Error(checklistError.message);

  const { error } = await supabase.from("checklist_items").insert(parsed);
  if (error) throw new Error(error.message);

  await refreshChecklistPercent(supabase, checklist.service_card_id);
  revalidatePath(`/servicos/${checklist.service_card_id}`);
  revalidatePath("/servicos");
}

export async function toggleChecklistItemAction(
  itemId: string,
  checklistId: string,
  isDone: boolean,
) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("service_card_id")
    .eq("id", checklistId)
    .single();
  if (checklistError) throw new Error(checklistError.message);

  const { error } = await supabase
    .from("checklist_items")
    .update({ is_done: isDone })
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await refreshChecklistPercent(supabase, checklist.service_card_id);
  revalidatePath(`/servicos/${checklist.service_card_id}`);
  revalidatePath("/servicos");
}

async function refreshChecklistPercent(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  serviceCardId: string,
) {
  const { data: checklistsData } = await supabase
    .from("checklists")
    .select("id")
    .eq("service_card_id", serviceCardId);
  const checklists = checklistsData ?? [];

  const ids = checklists.map((item) => item.id);
  if (!ids.length) {
    await supabase
      .from("service_cards")
      .update({ checklist_percent: 0 })
      .eq("id", serviceCardId);
    return;
  }

  const { data: itemsData } = await supabase
    .from("checklist_items")
    .select("is_done")
    .in("checklist_id", ids);
  const items = itemsData ?? [];

  const total = items.length;
  const done = items.filter((item) => item.is_done).length;
  const percent = total ? Number(((done / total) * 100).toFixed(2)) : 0;

  await supabase
    .from("service_cards")
    .update({ checklist_percent: percent })
    .eq("id", serviceCardId);
}
