"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function updateContractDraftAction(contractId: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const raw = formDataToObject(formData);

  const clauses = splitLines(raw.clauses);
  const signers = [
    signer("contratante", raw.signer_client_name, raw.signer_client_document, raw.signer_client_email),
    signer("responsavel", raw.signer_owner_name, raw.signer_owner_document, raw.signer_owner_email),
    signer("testemunha_1", raw.witness_one_name, raw.witness_one_document, raw.witness_one_email),
    signer("testemunha_2", raw.witness_two_name, raw.witness_two_document, raw.witness_two_email),
  ].filter((item) => item.name || item.document || item.email);

  const modelData: Json = {
    registry: {
      title: text(raw.title),
      contractor_notes: text(raw.contractor_notes),
    },
    demand: {
      object: text(raw.object),
      services: text(raw.services),
    },
    deadlines: {
      execution_deadline: text(raw.execution_deadline),
      starts_at: text(raw.starts_at),
      ends_at: text(raw.ends_at),
    },
    finance: {
      payment_terms: text(raw.payment_terms),
      payment_methods: splitLines(raw.payment_methods),
    },
    model: {
      appearance: text(raw.appearance),
    },
  };

  const { error } = await supabase
    .from("contracts")
    .update({
      title: text(raw.title) ?? undefined,
      description: text(raw.object),
      starts_at: text(raw.starts_at),
      ends_at: text(raw.ends_at),
      forum: text(raw.forum),
      clauses_json: clauses,
      signers_json: signers,
      model_data: modelData,
    })
    .eq("id", contractId)
    .eq("organization_id", organization.id);
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "contract.draft_updated",
    entityType: "contract",
    entityId: contractId,
  });

  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contractId}`);
}

function text(value: FormDataEntryValue | undefined) {
  const normalized = value?.toString().trim();
  return normalized ? normalized : null;
}

function splitLines(value: FormDataEntryValue | undefined) {
  return (
    value
      ?.toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean) ?? []
  );
}

function signer(
  role: string,
  name: FormDataEntryValue | undefined,
  document: FormDataEntryValue | undefined,
  email: FormDataEntryValue | undefined,
) {
  return {
    role,
    name: text(name),
    document: text(document),
    email: text(email),
  };
}
