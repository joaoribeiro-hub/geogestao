"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser, requireOrganizationManager } from "@/lib/organization";
import {
  companyKnowledgeBlockSchema,
  companyKnowledgeCategorySchema,
  companyKnowledgeChecklistItemSchema,
  companyKnowledgeItemSchema,
  companyBankSettingsSchema,
  companyServiceSchema,
  companySettingsSchema,
  hrAbsenceSchema,
  hrBirthdaySchema,
  hrDocumentSchema,
  teamMemberSchema,
} from "@/lib/schemas";
import {
  buildTeamMemberExpenseDescription,
  shouldCreateTeamMemberMonthlyExpense,
} from "@/lib/services/team-finance";
import { buildExpectedMinutesJson } from "@/lib/services/work-time";
import { slugifyCompanyKnowledge } from "@/lib/company-knowledge";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  assertOrganizationStorageQuota,
  buildOrganizationStoragePath,
} from "@/lib/organization";
import { assertSafeOrganizationStoragePath } from "@/lib/services/organization-files";

export async function updateCompanySettingsAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
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

export async function updateCompanyBankSettingsAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = companyBankSettingsSchema.parse(formDataToObject(formData));

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
    action: "company_settings.bank_updated",
    entityType: "company_settings",
    entityId: data.id,
  });

  revalidatePath("/minha-empresa");
}

export async function createCompanyServiceAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
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
  await requireOrganizationManager(supabase, organization.id, user.id);
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

export async function createTeamMemberAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = teamMemberSchema.parse(formDataToObject(formData));
  const monthlyAmount = parsed.monthly_amount ? Number(parsed.monthly_amount) : null;
  const expectedMinutes = buildTeamMemberSchedule(parsed);

  const { data: member, error } = await supabase
    .from("team_members")
    .insert({
      organization_id: organization.id,
      name: parsed.name,
      email: parsed.email,
      document_number: parsed.document_number,
      pix_key: parsed.pix_key,
      bank_details: {
        bank_name: parsed.bank_name,
        bank_agency: parsed.bank_agency,
        bank_account: parsed.bank_account,
      },
      monthly_amount: monthlyAmount,
      role_title: parsed.role_title,
      birth_date: parsed.birth_date,
      work_schedule_type: parsed.work_schedule_type,
      expected_minutes_by_weekday: expectedMinutes,
      default_work_start: parsed.default_work_start,
      default_work_end: parsed.default_work_end,
      notes: parsed.notes,
      status: parsed.status,
      created_by: user.id,
    })
    .select("id,name")
    .single();
  if (error) throw new Error(error.message);

  if (shouldCreateTeamMemberMonthlyExpense(monthlyAmount)) {
    const description = buildTeamMemberExpenseDescription(member.name);
    const { data: recurring, error: recurringError } = await supabase
      .from("recurring_expenses")
      .insert({
        organization_id: organization.id,
        team_member_id: member.id,
        amount: monthlyAmount,
        description,
        recurrence: "monthly",
        status: "active",
        next_due_date: new Date().toISOString().slice(0, 10),
        category: "Equipe / Mao de obra / Prestadores",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (recurringError) throw new Error(recurringError.message);

    const { error: expenseError } = await supabase.from("expenses").insert({
      organization_id: organization.id,
      team_member_id: member.id,
      recurring_expense_id: recurring.id,
      description,
      category: "Equipe / Mao de obra / Prestadores",
      amount: monthlyAmount,
      due_date: new Date().toISOString().slice(0, 10),
      status: "pending",
    });
    if (expenseError) throw new Error(expenseError.message);
  }

  await logAudit(supabase, {
    action: "team_member.created",
    entityType: "team_member",
    entityId: member.id,
  });

  revalidatePath("/minha-empresa");
  revalidatePath("/financeiro");
  return { ok: true, teamMemberId: member.id };
}

export async function updateTeamMemberAction(memberId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = teamMemberSchema.parse(formDataToObject(formData));
  const monthlyAmount = parsed.monthly_amount ? Number(parsed.monthly_amount) : null;
  const expectedMinutes = buildTeamMemberSchedule(parsed);

  const { data: member, error } = await supabase
    .from("team_members")
    .update({
      name: parsed.name,
      email: parsed.email,
      document_number: parsed.document_number,
      pix_key: parsed.pix_key,
      bank_details: {
        bank_name: parsed.bank_name,
        bank_agency: parsed.bank_agency,
        bank_account: parsed.bank_account,
      },
      monthly_amount: monthlyAmount,
      role_title: parsed.role_title,
      birth_date: parsed.birth_date,
      work_schedule_type: parsed.work_schedule_type,
      expected_minutes_by_weekday: expectedMinutes,
      default_work_start: parsed.default_work_start,
      default_work_end: parsed.default_work_end,
      notes: parsed.notes,
      status: parsed.status,
    })
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .select("id,name")
    .single();
  if (error) throw new Error(error.message);

  await syncTeamMemberMonthlyExpense({
    supabase,
    organizationId: organization.id,
    userId: user.id,
    memberId: member.id,
    memberName: member.name,
    monthlyAmount,
    active: parsed.status === "active",
  });

  await logAudit(supabase, {
    action: "team_member.updated",
    entityType: "team_member",
    entityId: member.id,
  });

  revalidatePath("/minha-empresa");
  revalidatePath("/financeiro");
  return { ok: true, teamMemberId: member.id };
}

function buildTeamMemberSchedule(parsed: ReturnType<typeof teamMemberSchema.parse>) {
  if (parsed.work_schedule_type === "5x2") {
    return buildExpectedMinutesJson({ 0: 0, 1: 480, 2: 480, 3: 480, 4: 480, 5: 480, 6: 0 });
  }
  if (parsed.work_schedule_type === "6x1") {
    return buildExpectedMinutesJson({ 0: 0, 1: 480, 2: 480, 3: 480, 4: 480, 5: 480, 6: 240 });
  }
  return buildExpectedMinutesJson({
    0: parsed.expected_minutes_0,
    1: parsed.expected_minutes_1,
    2: parsed.expected_minutes_2,
    3: parsed.expected_minutes_3,
    4: parsed.expected_minutes_4,
    5: parsed.expected_minutes_5,
    6: parsed.expected_minutes_6,
  });
}

export async function createCompanyKnowledgeItemAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = companyKnowledgeItemSchema.parse(formDataToObject(formData));
  const { data, error } = await supabase
    .from("company_knowledge_items")
    .insert({
      ...parsed,
      slug: slugifyCompanyKnowledge(parsed.title),
      organization_id: organization.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logAudit(supabase, { action: "company_knowledge.item_created", entityType: "company_knowledge_item", entityId: data.id });
  revalidatePath("/minha-empresa");
}

export async function updateCompanyKnowledgeItemAction(itemId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = companyKnowledgeItemSchema.parse(formDataToObject(formData));
  const { error } = await supabase
    .from("company_knowledge_items")
    .update({
      ...parsed,
      slug: slugifyCompanyKnowledge(parsed.title),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
  revalidatePath(`/minha-empresa/base-interna/${itemId}`);
}

export async function createCompanyKnowledgeCategoryAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = companyKnowledgeCategorySchema.parse(formDataToObject(formData));
  const slug = slugifyCompanyKnowledge(parsed.name);
  const { count } = await supabase
    .from("company_knowledge_categories")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id);
  const { error } = await supabase.from("company_knowledge_categories").upsert(
    {
      organization_id: organization.id,
      name: parsed.name,
      slug,
      position: (count ?? 0) + 1,
      sort_order: (count ?? 0) + 1,
    },
    { onConflict: "organization_id,slug" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
}

export async function createCompanyKnowledgeBlockAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = companyKnowledgeBlockSchema.parse(formDataToObject(formData));
  const { data, error } = await supabase
    .from("company_knowledge_blocks")
    .insert({ ...parsed, organization_id: organization.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logAudit(supabase, { action: "company_knowledge.block_created", entityType: "company_knowledge_block", entityId: data.id });
  revalidatePath("/minha-empresa");
  revalidatePath(`/minha-empresa/base-interna/${parsed.item_id}`);
}

export async function updateCompanyKnowledgeBlockAction(blockId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = companyKnowledgeBlockSchema.parse(formDataToObject(formData));
  const { error } = await supabase
    .from("company_knowledge_blocks")
    .update({ title: parsed.title, content: parsed.content, updated_at: new Date().toISOString() })
    .eq("id", blockId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
  revalidatePath(`/minha-empresa/base-interna/${parsed.item_id}`);
}

export async function deleteCompanyKnowledgeBlockAction(blockId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const { data: block } = await supabase
    .from("company_knowledge_blocks")
    .select("item_id")
    .eq("id", blockId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  const { error } = await supabase
    .from("company_knowledge_blocks")
    .delete()
    .eq("id", blockId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
  if (block?.item_id) revalidatePath(`/minha-empresa/base-interna/${block.item_id}`);
}

export async function createCompanyKnowledgeChecklistItemAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = companyKnowledgeChecklistItemSchema.parse(formDataToObject(formData));
  const { error } = await supabase.from("company_knowledge_checklist_items").insert({
    ...parsed,
    organization_id: organization.id,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
  revalidatePath(`/minha-empresa/base-interna/${parsed.knowledge_item_id}`);
}

export async function toggleCompanyKnowledgeChecklistItemAction(itemId: string, done: boolean) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const { data: item } = await supabase
    .from("company_knowledge_checklist_items")
    .select("knowledge_item_id")
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  const { error } = await supabase
    .from("company_knowledge_checklist_items")
    .update({
      is_done: done,
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
  if (item?.knowledge_item_id) revalidatePath(`/minha-empresa/base-interna/${item.knowledge_item_id}`);
}

export async function deleteCompanyKnowledgeChecklistItemAction(itemId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const { data: item } = await supabase
    .from("company_knowledge_checklist_items")
    .select("knowledge_item_id")
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  const { error } = await supabase
    .from("company_knowledge_checklist_items")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
  if (item?.knowledge_item_id) revalidatePath(`/minha-empresa/base-interna/${item.knowledge_item_id}`);
}

export async function prepareHrDocumentUploadAction({
  fileName,
  sizeBytes,
}: {
  fileName: string;
  sizeBytes: number;
}) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  if (sizeBytes <= 0 || sizeBytes > 50 * 1024 * 1024) throw new Error("O arquivo deve ter ate 50 MB.");
  await assertOrganizationStorageQuota(supabase, organization.id, sizeBytes);
  return {
    bucket: "attachments",
    filePath: buildOrganizationStoragePath({
      organizationId: organization.id,
      folder: "hr/documents",
      fileName,
    }),
  };
}

export async function createHrDocumentWithUploadAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Envie um arquivo para anexar.");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("O arquivo deve ter ate 50 MB.");
  }
  await assertOrganizationStorageQuota(supabase, organization.id, file.size);
  const filePath = buildOrganizationStoragePath({
    organizationId: organization.id,
    folder: "hr/documents",
    fileName: `${crypto.randomUUID()}-${file.name}`,
  });
  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const parsed = hrDocumentSchema.parse({
    ...formDataToObject(formData),
    storage_path: filePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
  });
  const { error } = await supabase.from("hr_documents").insert({
    ...parsed,
    organization_id: organization.id,
    created_by: user.id,
  });
  if (error) {
    await supabase.storage.from("attachments").remove([filePath]);
    throw new Error(error.message);
  }
  revalidatePath("/minha-empresa");
}

export async function createHrDocumentAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = hrDocumentSchema.parse(formDataToObject(formData));
  assertSafeOrganizationStoragePath(organization.id, parsed.storage_path);
  const { error } = await supabase.from("hr_documents").insert({
    ...parsed,
    organization_id: organization.id,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
}

export async function updateHrDocumentAction(documentId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = hrDocumentSchema.parse(formDataToObject(formData));
  assertSafeOrganizationStoragePath(organization.id, parsed.storage_path);
  const { error } = await supabase
    .from("hr_documents")
    .update({
      team_member_id: parsed.team_member_id,
      document_type: parsed.document_type,
      title: parsed.title,
      document_date: parsed.document_date,
      due_date: parsed.due_date,
      status: parsed.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
}

export async function deleteHrDocumentAction(documentId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const { data: doc, error } = await supabase
    .from("hr_documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", organization.id)
    .single();
  if (error) throw new Error(error.message);
  if (doc.storage_path) {
    assertSafeOrganizationStoragePath(organization.id, doc.storage_path);
    await supabase.storage.from("attachments").remove([doc.storage_path]);
  }
  const { error: deleteError } = await supabase
    .from("hr_documents")
    .delete()
    .eq("id", documentId)
    .eq("organization_id", organization.id);
  if (deleteError) throw new Error(deleteError.message);
  revalidatePath("/minha-empresa");
}

export async function createHrAbsenceAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = hrAbsenceSchema.parse(formDataToObject(formData));
  const { error } = await supabase.from("hr_absences").insert({
    ...parsed,
    organization_id: organization.id,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
}

export async function deleteHrAbsenceAction(absenceId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const { error } = await supabase
    .from("hr_absences")
    .delete()
    .eq("id", absenceId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
}

export async function createHrBirthdayAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const parsed = hrBirthdaySchema.parse(formDataToObject(formData));
  const { error } = await supabase.from("hr_birthdays").insert({
    ...parsed,
    organization_id: organization.id,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
}

export async function deleteHrBirthdayAction(birthdayId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);
  const { error } = await supabase
    .from("hr_birthdays")
    .delete()
    .eq("id", birthdayId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minha-empresa");
}

export async function deleteTeamMemberAction(memberId: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  await requireOrganizationManager(supabase, organization.id, user.id);

  const { data: member, error } = await supabase
    .from("team_members")
    .select("id,name")
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("recurring_expenses")
    .update({ status: "inactive" })
    .eq("team_member_id", member.id)
    .eq("organization_id", organization.id);

  const { error: expenseDeleteError } = await supabase
    .from("expenses")
    .delete()
    .eq("team_member_id", member.id)
    .eq("organization_id", organization.id)
    .neq("status", "paid");
  if (expenseDeleteError) throw new Error(expenseDeleteError.message);

  const { error: deleteError } = await supabase
    .from("team_members")
    .delete()
    .eq("id", member.id)
    .eq("organization_id", organization.id);
  if (deleteError) throw new Error(deleteError.message);

  await logAudit(supabase, {
    action: "team_member.deleted",
    entityType: "team_member",
    entityId: member.id,
    metadata: { name: member.name },
  });

  revalidatePath("/minha-empresa");
  revalidatePath("/financeiro");
}

async function syncTeamMemberMonthlyExpense({
  supabase,
  organizationId,
  userId,
  memberId,
  memberName,
  monthlyAmount,
  active,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  memberId: string;
  memberName: string;
  monthlyAmount: number | null;
  active: boolean;
}) {
  const shouldBeActive = active && shouldCreateTeamMemberMonthlyExpense(monthlyAmount);
  const description = buildTeamMemberExpenseDescription(memberName);
  const { data: recurringRows, error: recurringFindError } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("team_member_id", memberId)
    .limit(1);
  if (recurringFindError) throw new Error(recurringFindError.message);

  const recurring = recurringRows?.[0] ?? null;

  if (!shouldBeActive) {
    if (recurring) {
      const { error } = await supabase
        .from("recurring_expenses")
        .update({ status: "inactive" })
        .eq("id", recurring.id);
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("organization_id", organizationId)
      .eq("team_member_id", memberId)
      .neq("status", "paid");
    if (error) throw new Error(error.message);
    return;
  }

  const amount = monthlyAmount ?? 0;
  let recurringId = recurring?.id ?? null;
  if (recurring) {
    const { error } = await supabase
      .from("recurring_expenses")
      .update({
        amount,
        description,
        status: "active",
        category: "Equipe / Mao de obra / Prestadores",
      })
      .eq("id", recurring.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({
        organization_id: organizationId,
        team_member_id: memberId,
        amount,
        description,
        recurrence: "monthly",
        status: "active",
        next_due_date: new Date().toISOString().slice(0, 10),
        category: "Equipe / Mao de obra / Prestadores",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    recurringId = data.id;
  }

  const { data: expenses, error: expenseFindError } = await supabase
    .from("expenses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("team_member_id", memberId)
    .neq("status", "paid")
    .limit(1);
  if (expenseFindError) throw new Error(expenseFindError.message);

  const expensePayload = {
    recurring_expense_id: recurringId,
    description,
    category: "Equipe / Mao de obra / Prestadores",
    amount,
    due_date: new Date().toISOString().slice(0, 10),
    status: "pending" as const,
  };

  const existingExpenseId = expenses?.[0]?.id;
  if (existingExpenseId) {
    const { error } = await supabase.from("expenses").update(expensePayload).eq("id", existingExpenseId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("expenses").insert({
    organization_id: organizationId,
    team_member_id: memberId,
    ...expensePayload,
  });
  if (error) throw new Error(error.message);
}
