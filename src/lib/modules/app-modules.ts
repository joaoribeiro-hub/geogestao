export type AppModuleStatus = "ativo" | "beta" | "worker_pendente" | "em_migracao" | "indisponivel";

export type AppModuleDefinition = {
  key: string;
  name: string;
  shortName: string;
  description: string;
  route: string;
  status: AppModuleStatus;
};

export const APP_MODULES: AppModuleDefinition[] = [
  {
    key: "geogestao",
    name: "GeoGestao",
    shortName: "GeoGestao",
    description: "Central principal de operacao, servicos, clientes, financeiro e equipe.",
    route: "/inicio",
    status: "ativo",
  },
  {
    key: "meu-imovel-car",
    name: "MeuIMOVEL-CAR",
    shortName: "MeuIMOVEL-CAR",
    description: "Consulta operacional de CAR, imoveis, historico e bases GeoQuery da organizacao.",
    route: "/modulos/meu-imovel-car",
    status: "beta",
  },
  {
    key: "buscageo",
    name: "BuscaGEO",
    shortName: "BuscaGEO",
    description: "Busca de cenas CBERS com jobs persistidos, previews e worker GDAL/FastAPI.",
    route: "/modulos/buscageo",
    status: "beta",
  },
  {
    key: "corretor-rtk-ppp",
    name: "Corretor RTK/PPP",
    shortName: "RTK/PPP",
    description: "Correcao linear de pontos rover por delta entre base levantada e base corrigida.",
    route: "/modulos/corretor-rtk-ppp",
    status: "beta",
  },
  {
    key: "gerador-rw5",
    name: "Gerador RW5",
    shortName: "Gerador RW5",
    description: "Conversao beta de arquivos topograficos TXT/PTS/MC/legados para RW5.",
    route: "/modulos/gerador-rw5",
    status: "beta",
  },
  {
    key: "app-2026-05-29",
    name: "App 2026-05-29",
    shortName: "App 2026-05-29",
    description: "Pasta nao encontrada neste ambiente; modulo registrado para migracao futura.",
    route: "/modulos/app-2026-05-29",
    status: "indisponivel",
  },
];

export function getModuleByRoute(pathname: string) {
  return APP_MODULES.find((module) => pathname === module.route || pathname.startsWith(`${module.route}/`)) ?? APP_MODULES[0];
}

export function getModuleByKey(key: string) {
  return APP_MODULES.find((module) => module.key === key) ?? null;
}

export function getModuleStatusLabel(status: AppModuleStatus) {
  const labels: Record<AppModuleStatus, string> = {
    ativo: "Ativo",
    beta: "Beta",
    worker_pendente: "Worker pendente",
    em_migracao: "Em migracao",
    indisponivel: "Indisponivel",
  };
  return labels[status];
}
