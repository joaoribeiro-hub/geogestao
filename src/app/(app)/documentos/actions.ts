"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { documentTemplateSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createDocumentTemplateAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = documentTemplateSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("document_templates")
    .insert({ ...parsed, organization_id: organization.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "document_template.created",
    entityType: "document_template",
    entityId: data.id,
  });

  revalidatePath("/documentos");
}

export async function deleteDocumentTemplateAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { error } = await supabase
    .from("document_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    action: "document_template.deleted",
    entityType: "document_template",
    entityId: id,
  });
  revalidatePath("/documentos");
}
