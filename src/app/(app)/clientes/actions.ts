"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { clientSchema, interactionSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createClientAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = clientSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed, organization_id: organization.id, created_by: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    action: "client.created",
    entityType: "client",
    entityId: data.id,
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function updateClientAction(clientId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = clientSchema.parse(formDataToObject(formData));

  const { error } = await supabase
    .from("clients")
    .update(parsed)
    .eq("id", clientId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "client.updated",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
}

export async function deleteClientAction(clientId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "client.deleted",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function createInteractionAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = interactionSchema.parse(formDataToObject(formData));

  const { error } = await supabase.from("client_interactions").insert({
    ...parsed,
    organization_id: organization.id,
    responsible_id: user.id,
  });
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "client_interaction.created",
    entityType: "client",
    entityId: parsed.client_id,
  });

  revalidatePath(`/clientes/${parsed.client_id}`);
}
