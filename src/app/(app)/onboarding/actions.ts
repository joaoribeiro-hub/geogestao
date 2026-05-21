"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";

const joinOrganizationSchema = z.object({
  joinCode: z.string().trim().min(6, "Informe o ID da empresa."),
});

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa."),
  documentNumber: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .pipe(z.string().email("E-mail comercial invalido.").or(z.literal(""))),
  address: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  state: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export type OnboardingActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function joinOrganizationByCodeAction(
  values: z.input<typeof joinOrganizationSchema>,
): Promise<OnboardingActionState> {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const parsed = joinOrganizationSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Informe o ID da empresa." };
  }

  console.log("[ONBOARDING] Iniciando entrada por codigo");
  console.log("[ONBOARDING] Usuario autenticado:", user.id);
  console.log("[ONBOARDING] Tabela de empresa usada: organizations");
  console.log("[ONBOARDING] Tabela de vinculo usada: organization_members");

  const { error } = await supabase.rpc("join_organization_by_code", {
    p_join_code: parsed.data.joinCode,
  });

  if (error) {
    logSupabaseError("[ONBOARDING] Erro no vinculo, se houver", error);
    return { ok: false, message: normalizeOnboardingError(error) };
  }

  console.log("[ONBOARDING] Resultado final do onboarding: usuario vinculado por codigo");
  revalidatePath("/");
  revalidatePath("/onboarding");
  return { ok: true, message: "Empresa vinculada. Bem-vindo ao GeoGestao." };
}

export async function createOrganizationAction(
  values: z.input<typeof createOrganizationSchema>,
): Promise<OnboardingActionState> {
  const supabase = await createServerSupabase();
  console.log("[ONBOARDING] Iniciando cadastro de empresa");
  const user = await requireUser(supabase);
  console.log("[ONBOARDING] Usuario autenticado:", user.id);
  const parsed = createOrganizationSchema.safeParse(values);
  if (!parsed.success) {
    console.log("[ONBOARDING] Validacao falhou:", parsed.error.issues.map((issue) => issue.message));
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados da empresa." };
  }

  const payload = {
    p_name: parsed.data.name,
    p_document_number: parsed.data.documentNumber || null,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_address: parsed.data.address || null,
    p_city: parsed.data.city || null,
    p_state: parsed.data.state || null,
    p_notes: parsed.data.notes || null,
  };

  console.log("[ONBOARDING] Dados recebidos:", {
    nomeEmpresa: parsed.data.name,
    documento: maskDocument(parsed.data.documentNumber),
    telefone: maskPhone(parsed.data.phone),
    email: maskEmail(parsed.data.email),
    cidade: parsed.data.city || null,
    estado: parsed.data.state || null,
  });
  console.log("[ONBOARDING] Tabela de empresa usada: organizations");
  console.log("[ONBOARDING] Tabela de vinculo usada: organization_members");
  console.log("[ONBOARDING] Tabela de profile usada: profiles");
  console.log("[ONBOARDING] Payload enviado para insert:", {
    name: payload.p_name,
    document_number: maskDocument(parsed.data.documentNumber),
    owner_user_id: user.id,
    plan: "iniciante",
    status: "active",
  });
  console.log("[ONBOARDING] Tentando criar empresa...");

  const { data, error } = await supabase.rpc("create_organization_for_current_user", payload);

  if (error) {
    console.log("[ONBOARDING] Resultado do insert da empresa: falha");
    logSupabaseError("[ONBOARDING] Erro Supabase ao criar empresa, se houver", error);
    return { ok: false, message: normalizeOnboardingError(error) };
  }

  const created = data?.[0];
  console.log("[ONBOARDING] Resultado do insert da empresa: sucesso");
  console.log("[ONBOARDING] Empresa criada com id:", created?.organization_id ?? null);
  console.log("[ONBOARDING] Tentando vincular usuario a empresa...");
  console.log("[ONBOARDING] Resultado do vinculo: executado pela RPC create_organization_for_current_user");
  console.log("[ONBOARDING] Tentando atualizar profile/organization_id, se existir");
  console.log("[ONBOARDING] Resultado final do onboarding:", {
    organizationId: created?.organization_id ?? null,
    hasJoinCode: Boolean(created?.join_code),
  });

  revalidatePath("/");
  revalidatePath("/onboarding");
  return { ok: true, message: "Empresa criada. Voce agora e o proprietario da organizacao." };
}

function normalizeOnboardingError(error: Pick<PostgrestError, "message">) {
  const message = error.message;
  if (message.includes("limite de usuarios")) {
    return "Esta empresa atingiu o limite de usuarios do plano atual.";
  }
  if (message.includes("Codigo da empresa invalido")) {
    return "ID da empresa invalido. Confira o codigo com o proprietario.";
  }
  if (message.includes("ja participa")) {
    return "Este usuario ja participa de uma empresa.";
  }
  if (process.env.NODE_ENV !== "production") {
    return `Erro ao criar empresa: ${message}`;
  }
  return "Nao foi possivel concluir o onboarding agora.";
}

function logSupabaseError(label: string, error: PostgrestError) {
  console.error(label, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function maskDocument(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

function maskEmail(value: string) {
  if (!value) return null;
  const [name, domain] = value.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}
