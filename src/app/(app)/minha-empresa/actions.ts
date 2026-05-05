"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import {
  companyServiceSchema,
  companySettingsSchema,
} from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function updateCompanySettingsAction(formData: FormData) {
  const supabase = await createServerSupabase();
  await requireUser(supabase);
  const parsed = companySettingsSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("company_settings")
    .upsert(
      {
        singleton_key: "default",
        ...parsed,
      },
      { onConflict: "singleton_key" },
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
  await requireUser(supabase);
  const parsed = companyServiceSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("company_services")
    .insert(parsed)
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
  await requireUser(supabase);
  const parsed = companyServiceSchema.parse(formDataToObject(formData));

  const { error } = await supabase
    .from("company_services")
    .update(parsed)
    .eq("id", serviceId);

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "company_service.updated",
    entityType: "company_service",
    entityId: serviceId,
  });

  revalidatePath("/minha-empresa");
}
