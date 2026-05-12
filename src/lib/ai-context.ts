import type { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentOrganizationForUser } from "@/lib/organization";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type AiContext = {
  organizationName: string;
  clientsCount: number;
  openProposalsCount: number;
  pendingContractsCount: number;
  overdueServicesCount: number;
  pendingRevenuesCount: number;
};

async function countQuery(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getAiContextForUser(
  supabase: ServerSupabase,
  userId: string,
): Promise<AiContext> {
  const organization = await getCurrentOrganizationForUser(supabase, userId);
  const today = new Date().toISOString().slice(0, 10);

  const [
    clientsCount,
    openProposalsCount,
    pendingContractsCount,
    overdueServicesCount,
    pendingRevenuesCount,
  ] = await Promise.all([
    countQuery(
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id),
    ),
    countQuery(
      supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .in("stage", ["todo", "sent", "negotiation", "execution"]),
    ),
    countQuery(
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .in("status", [
          "contrato_a_gerar",
          "contrato_gerado",
          "enviado_para_assinatura",
        ]),
    ),
    countQuery(
      supabase
        .from("service_cards")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .lt("due_date", today),
    ),
    countQuery(
      supabase
        .from("revenues")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("status", "pending"),
    ),
  ]);

  return {
    organizationName: organization.trade_name ?? organization.name,
    clientsCount,
    openProposalsCount,
    pendingContractsCount,
    overdueServicesCount,
    pendingRevenuesCount,
  };
}

export function formatAiContext(context: AiContext) {
  return [
    `Empresa: ${context.organizationName}`,
    `Clientes cadastrados: ${context.clientsCount}`,
    `Propostas abertas/em andamento: ${context.openProposalsCount}`,
    `Contratos pendentes: ${context.pendingContractsCount}`,
    `Servicos com vencimento atrasado: ${context.overdueServicesCount}`,
    `Receitas pendentes: ${context.pendingRevenuesCount}`,
  ].join("\n");
}

export function extractOpenAiResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .filter((item): item is string => typeof item === "string")
    .join("\n")
    .trim();

  return text || null;
}
