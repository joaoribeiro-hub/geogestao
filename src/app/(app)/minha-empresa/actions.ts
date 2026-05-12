"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import {
  companyServiceSchema,
  companySettingsSchema,
} from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function updateCompanySettingsAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = companySettingsSchema.parse(formDataToObject(formData));

  const { error: organizationError } = await supabase
    .from("organizations")
    .update({
      name: parsed.legal_name ?? parsed.trade_name ?? organization.name,
      trade_name: parsed.trade_name,
      document_number: parsed.cnpj,
    })
    .eq("id", organization.id);
  if (organizationError) throw new Error(organizationError.message);

  const { data, error } = await supabase
    .from("company_settings")
    .upsert(
      {
        organization_id: organization.id,
        singleton_key: "default",
        ...parsed,
      },
      { onConflict: "organization_id,singleton_key" },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "company_settings.updated",
    entityType: "company_settings",
    entityId: data.id,
  });

  revalidatePath("/minha-empresa");
}

export async function createCompanyServiceAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = companyServiceSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("company_services")
    .insert({ ...parsed, organization_id: organization.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "company_service.created",
    entityType: "company_service",
    entityId: data.id,
  });

  revalidatePath("/minha-empresa");
}

export async function updateCompanyServiceAction(serviceId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = companyServiceSchema.parse(formDataToObject(formData));

  const { error } = await supabase
    .from("company_services")
    .update(parsed)
    .eq("id", serviceId)
    .eq("organization_id", organization.id);

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "company_service.updated",
    entityType: "company_service",
    entityId: serviceId,
  });

  revalidatePath("/minha-empresa");
}
