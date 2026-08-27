import type { SupabaseClient } from "@supabase/supabase-js";
import { isToolVisibleForProfile, type OperationalProfile } from "@/lib/operational-profile";

export type ToolStatus = "active" | "beta" | "coming_soon" | "unavailable";
export type ToolPricingMode = "included" | "free_beta" | "paid" | "disabled";

export type GeoGestaoTool = {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: "Gestao" | "Cliente" | "Geoespacial" | "Ambiental" | "Topografia" | "Campo" | "Documentos";
  iconName: string;
  routePath: string;
  status: ToolStatus;
  pricingMode: ToolPricingMode;
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  isEnabled: boolean;
  isVisible: boolean;
  isPurchasable: boolean;
  requiresWorker: boolean;
  requiresExternalConfig: boolean;
  sortOrder: number;
  tags: string[];
};

export const GEOGESTAO_TOOLS: GeoGestaoTool[] = [
  {
    slug: "meu-imovel-car",
    name: "MeuIMOVEL-CAR",
    shortDescription: "Consulta de imóvel rural, CAR, SIGEF/INCRA, alertas e histórico.",
    longDescription:
      "Consulta operacional de imóvel rural, CAR, SIGEF/INCRA, alertas, histórico e bases GeoQuery integradas ao GeoGestão.",
    category: "Geoespacial",
    iconName: "Map",
    routePath: "/modulos/meu-imovel-car",
    status: "beta",
    pricingMode: "free_beta",
    monthlyPriceCents: null,
    annualPriceCents: null,
    isEnabled: true,
    isVisible: true,
    isPurchasable: false,
    requiresWorker: false,
    requiresExternalConfig: false,
    sortOrder: 10,
    tags: ["CAR", "SIGEF", "GeoQuery"],
  },
  {
    slug: "buscageo",
    name: "BuscaGEO",
    shortDescription: "Busca cenas CBERS por polígono, preview, jobs e GeoTIFF.",
    longDescription:
      "Busca de cenas CBERS por polígono, preview, processamento persistido e geração de GeoTIFF por worker geoespacial.",
    category: "Geoespacial",
    iconName: "Satellite",
    routePath: "/modulos/buscageo",
    status: "beta",
    pricingMode: "free_beta",
    monthlyPriceCents: null,
    annualPriceCents: null,
    isEnabled: true,
    isVisible: true,
    isPurchasable: false,
    requiresWorker: true,
    requiresExternalConfig: false,
    sortOrder: 20,
    tags: ["CBERS", "GeoTIFF", "Worker"],
  },
  {
    slug: "corretor-rtk-ppp",
    name: "Corretor RTK/PPP",
    shortDescription: "Corrige pontos rover por delta entre base levantada e PPP/IBGE.",
    longDescription:
      "Correção linear de pontos rover a partir do delta entre base levantada em campo e base corrigida por PPP/IBGE.",
    category: "Topografia",
    iconName: "Crosshair",
    routePath: "/modulos/corretor-rtk-ppp",
    status: "beta",
    pricingMode: "free_beta",
    monthlyPriceCents: null,
    annualPriceCents: null,
    isEnabled: true,
    isVisible: true,
    isPurchasable: false,
    requiresWorker: false,
    requiresExternalConfig: false,
    sortOrder: 30,
    tags: ["RTK", "PPP", "Topografia"],
  },
  {
    slug: "gerador-rw5",
    name: "Gerador RW5",
    shortDescription: "Converte arquivos topográficos TXT/PTS/MC/legados para RW5.",
    longDescription:
      "Conversão beta de arquivos topográficos TXT, PTS, MC e formatos legados para arquivo RW5 dentro do GeoGestão.",
    category: "Topografia",
    iconName: "FileOutput",
    routePath: "/modulos/gerador-rw5",
    status: "beta",
    pricingMode: "free_beta",
    monthlyPriceCents: null,
    annualPriceCents: null,
    isEnabled: true,
    isVisible: true,
    isPurchasable: false,
    requiresWorker: false,
    requiresExternalConfig: false,
    sortOrder: 40,
    tags: ["RW5", "TXT", "Campo"],
  },
  {
    slug: "portal-cliente",
    name: "Portal do Cliente",
    shortDescription: "Página pública segura para acompanhamento do serviço pelo cliente.",
    longDescription:
      "Portal seguro por serviço para mostrar progresso, etapas públicas, documentos liberados e atualizações sem expor dados internos.",
    category: "Cliente",
    iconName: "PanelTop",
    routePath: "/ferramentas/portal-cliente",
    status: "beta",
    pricingMode: "free_beta",
    monthlyPriceCents: null,
    annualPriceCents: null,
    isEnabled: true,
    isVisible: true,
    isPurchasable: false,
    requiresWorker: false,
    requiresExternalConfig: false,
    sortOrder: 50,
    tags: ["Cliente", "Serviços", "Documentos"],
  },
  {
    slug: "desenhar-geo",
    name: "Desenhar GEO",
    shortDescription: "Reconstrói perímetros por azimute, rumo ou deflexão.",
    longDescription:
      "Gerador de perímetro por azimute, rumo ou deflexão, com distância, confrontante, vértices, fechamento e exportações futuras.",
    category: "Topografia",
    iconName: "DraftingCompass",
    routePath: "/ferramentas/desenhar-geo",
    status: "beta",
    pricingMode: "free_beta",
    monthlyPriceCents: null,
    annualPriceCents: null,
    isEnabled: true,
    isVisible: true,
    isPurchasable: false,
    requiresWorker: false,
    requiresExternalConfig: false,
    sortOrder: 60,
    tags: ["Azimute", "Rumo", "DXF"],
  },
  {
    slug: "analise-ambiental",
    name: "Análise Ambiental",
    shortDescription: "Prepara análise ambiental rural por KML, camadas e worker GEO.",
    longDescription:
      "Análise ambiental rural por KML/KMZ, vegetação, corpos d'água, drenagens, hidrografia e exportações geoespaciais por worker Python.",
    category: "Ambiental",
    iconName: "Leaf",
    routePath: "/ferramentas/analise-ambiental",
    status: "beta",
    pricingMode: "free_beta",
    monthlyPriceCents: null,
    annualPriceCents: null,
    isEnabled: true,
    isVisible: true,
    isPurchasable: false,
    requiresWorker: true,
    requiresExternalConfig: true,
    sortOrder: 70,
    tags: ["KML", "MapBiomas", "ANA"],
  },
];

export function getAvailableToolsForOrganization(profile: OperationalProfile = "agrimensura") {
  return GEOGESTAO_TOOLS
    .filter((tool) => tool.isVisible && isToolVisibleForProfile(tool.slug, profile))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getMyTools(profile: OperationalProfile = "agrimensura") {
  return getAvailableToolsForOrganization(profile).filter((tool) => canUseTool(tool.slug));
}

export function getMoreTools(profile: OperationalProfile = "agrimensura") {
  return getAvailableToolsForOrganization(profile).filter((tool) => !canUseTool(tool.slug));
}

export function canUseTool(slug: string) {
  const tool = GEOGESTAO_TOOLS.find((item) => item.slug === slug);
  return Boolean(tool?.isVisible && tool.isEnabled);
}

export async function registerToolUsage({
  supabase,
  organizationId,
  userId,
  slug,
  action,
  metadata = {},
}: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  slug: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  if (!canUseTool(slug)) {
    return { ok: false, reason: "tool_unavailable" as const };
  }

  const { error } = await supabase.from("module_activity_logs").insert({
    organization_id: organizationId,
    module_key: slug,
    user_id: userId,
    action,
    metadata,
  });

  if (error) {
    return { ok: false, reason: "insert_failed" as const, error };
  }

  return { ok: true as const };
}

export function getToolBySlug(slug: string) {
  return GEOGESTAO_TOOLS.find((tool) => tool.slug === slug) ?? null;
}

export function getToolStatusLabel(status: ToolStatus) {
  const labels: Record<ToolStatus, string> = {
    active: "Disponível",
    beta: "Beta",
    coming_soon: "Em breve",
    unavailable: "Indisponível",
  };
  return labels[status];
}

export function getToolPricingLabel(pricingMode: ToolPricingMode) {
  const labels: Record<ToolPricingMode, string> = {
    included: "Inclusa",
    free_beta: "Em teste",
    paid: "Futuro pago",
    disabled: "Desativada",
  };
  return labels[pricingMode];
}
