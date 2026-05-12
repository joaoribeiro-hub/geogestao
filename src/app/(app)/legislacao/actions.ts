"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { legislationSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createLegislationAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = legislationSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("legislation_items")
    .insert({ ...parsed, organization_id: organization.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "legislation_item.created",
    entityType: "legislation_item",
    entityId: data.id,
  });

  revalidatePath("/legislacao");
}

export async function deleteLegislationAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { error } = await supabase
    .from("legislation_items")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    action: "legislation_item.deleted",
    entityType: "legislation_item",
    entityId: id,
  });
  revalidatePath("/legislacao");
}
