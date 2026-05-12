"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { financeSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createRevenueAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = financeSchema.parse(formDataToObject(formData));
  if (!parsed.client_id) throw new Error("Receitas precisam estar vinculadas a um cliente.");

  const { data, error } = await supabase
    .from("revenues")
    .insert({ ...parsed, organization_id: organization.id, client_id: parsed.client_id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "revenue.created",
    entityType: "revenue",
    entityId: data.id,
  });
  revalidatePath("/financeiro");
}

export async function createExpenseAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = financeSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...parsed, organization_id: organization.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "expense.created",
    entityType: "expense",
    entityId: data.id,
  });
  revalidatePath("/financeiro");
}
