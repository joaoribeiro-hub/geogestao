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

  const { count: servicesCount, error: servicesError } = await supabase
    .from("service_cards")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .eq("client_id", clientId);
  if (servicesError) throw new Error(servicesError.message);
  if ((servicesCount ?? 0) > 0) {
    throw new Error(
      "Este cliente possui servicos vinculados. Remova ou altere o vinculo antes de apagar.",
    );
  }

  const { count: attachmentsCount, error: attachmentsError } = await supabase
    .from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .eq("entity_type", "client")
    .eq("entity_id", clientId);
  if (attachmentsError) throw new Error(attachmentsError.message);
  if ((attachmentsCount ?? 0) > 0) {
    throw new Error(
      "Este cliente possui documentos anexados. Apague os documentos do cliente antes de apagar o cadastro.",
    );
  }

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
