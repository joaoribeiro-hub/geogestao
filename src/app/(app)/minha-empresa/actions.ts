"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser, requireOrganizationManager } from "@/lib/organization";
import {
  companyBankSettingsSchema,
  companyServiceSchema,
  companySettingsSchema,
  teamMemberSchema,
} from "@/lib/schemas";
import {
  buildTeamMemberExpenseDescription,
  shouldCreateTeamMemberMonthlyExpense,
} from "@/lib/services/team-finance";
import { createServerSupabase } from "@/lib/supabase/server";

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
