-- FERRAMENTAS-HUB-1
-- Hub interno de ferramentas, reaproveitando app_modules/organization_modules.

alter table if exists public.app_modules
  drop constraint if exists app_modules_status_check;

alter table if exists public.app_modules
  add constraint app_modules_status_check
  check (status in (
    'ativo',
    'active',
    'beta',
    'worker_pendente',
    'em_migracao',
    'coming_soon',
    'indisponivel',
    'unavailable'
  ));

alter table if exists public.app_modules
  add column if not exists short_description text,
  add column if not exists long_description text,
  add column if not exists category text,
  add column if not exists icon_name text,
  add column if not exists route_path text,
  add column if not exists pricing_mode text not null default 'free_beta',
  add column if not exists monthly_price_cents integer,
  add column if not exists annual_price_cents integer,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists is_visible boolean not null default true,
  add column if not exists is_purchasable boolean not null default false,
  add column if not exists requires_worker boolean not null default false,
  add column if not exists requires_external_config boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists tags text[] not null default '{}'::text[];

alter table if exists public.app_modules
  drop constraint if exists app_modules_pricing_mode_check;

alter table if exists public.app_modules
  add constraint app_modules_pricing_mode_check
  check (pricing_mode in ('included', 'free_beta', 'paid', 'disabled'));

update public.app_modules
set route_path = coalesce(route_path, route)
where route_path is null;

alter table if exists public.organization_modules
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'free_beta',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists purchased_at timestamptz,
  add column if not exists expires_at timestamptz;

alter table if exists public.organization_modules
  drop constraint if exists organization_modules_status_check;

alter table if exists public.organization_modules
  add constraint organization_modules_status_check
  check (status in ('active', 'trial', 'expired', 'blocked'));

alter table if exists public.organization_modules
  drop constraint if exists organization_modules_source_check;

alter table if exists public.organization_modules
  add constraint organization_modules_source_check
  check (source in ('manual', 'free_beta', 'purchase', 'admin'));

insert into public.app_modules (
  key,
  name,
  description,
  status,
  route,
  is_global,
  short_description,
  long_description,
  category,
  icon_name,
  route_path,
  pricing_mode,
  monthly_price_cents,
  annual_price_cents,
  is_enabled,
  is_visible,
  is_purchasable,
  requires_worker,
  requires_external_config,
  sort_order,
  tags
)
values
  (
    'meu-imovel-car',
    'MeuIMOVEL-CAR',
    'Consulta de imóvel rural, CAR, SIGEF/INCRA, alertas, histórico e bases GeoQuery.',
    'beta',
    '/modulos/meu-imovel-car',
    true,
    'Consulta de imóvel rural, CAR, SIGEF/INCRA, alertas e histórico.',
    'Consulta operacional de imóvel rural, CAR, SIGEF/INCRA, alertas, histórico e bases GeoQuery integradas ao GeoGestão.',
    'Geoespacial',
    'Map',
    '/modulos/meu-imovel-car',
    'free_beta',
    null,
    null,
    true,
    true,
    false,
    false,
    false,
    10,
    array['CAR', 'SIGEF', 'GeoQuery']
  ),
  (
    'buscageo',
    'BuscaGEO',
    'Busca cenas CBERS por polígono, preview, jobs persistidos e GeoTIFF.',
    'beta',
    '/modulos/buscageo',
    true,
    'Busca cenas CBERS por polígono, preview, jobs e GeoTIFF.',
    'Busca de cenas CBERS por polígono, preview, processamento persistido e geração de GeoTIFF por worker geoespacial.',
    'Geoespacial',
    'Satellite',
    '/modulos/buscageo',
    'free_beta',
    null,
    null,
    true,
    true,
    false,
    true,
    false,
    20,
    array['CBERS', 'GeoTIFF', 'Worker']
  ),
  (
    'corretor-rtk-ppp',
    'Corretor RTK/PPP',
    'Correção linear de pontos rover por delta entre base levantada e base corrigida PPP/IBGE.',
    'beta',
    '/modulos/corretor-rtk-ppp',
    true,
    'Corrige pontos rover por delta entre base levantada e PPP/IBGE.',
    'Correção linear de pontos rover a partir do delta entre base levantada em campo e base corrigida por PPP/IBGE.',
    'Topografia',
    'Crosshair',
    '/modulos/corretor-rtk-ppp',
    'free_beta',
    null,
    null,
    true,
    true,
    false,
    false,
    false,
    30,
    array['RTK', 'PPP', 'Topografia']
  ),
  (
    'gerador-rw5',
    'Gerador RW5',
    'Conversão de arquivos topográficos TXT/PTS/MC/legados para RW5.',
    'beta',
    '/modulos/gerador-rw5',
    true,
    'Converte arquivos topográficos TXT/PTS/MC/legados para RW5.',
    'Conversão beta de arquivos topográficos TXT, PTS, MC e formatos legados para arquivo RW5 dentro do GeoGestão.',
    'Topografia',
    'FileOutput',
    '/modulos/gerador-rw5',
    'free_beta',
    null,
    null,
    true,
    true,
    false,
    false,
    false,
    40,
    array['RW5', 'TXT', 'Campo']
  ),
  (
    'portal-cliente',
    'Portal do Cliente',
    'Página pública segura para o cliente acompanhar andamento do serviço, etapas e documentos liberados.',
    'beta',
    '/ferramentas/portal-cliente',
    true,
    'Página pública segura para acompanhamento do serviço pelo cliente.',
    'Portal seguro por serviço para mostrar progresso, etapas públicas, documentos liberados e atualizações sem expor dados internos.',
    'Cliente',
    'PanelTop',
    '/ferramentas/portal-cliente',
    'free_beta',
    null,
    null,
    true,
    true,
    false,
    false,
    false,
    50,
    array['Cliente', 'Serviços', 'Documentos']
  ),
  (
    'desenhar-geo',
    'Desenhar GEO',
    'Gerador de perímetro por azimute, rumo ou deflexão, com distância, confrontante e exportações futuras.',
    'beta',
    '/ferramentas/desenhar-geo',
    true,
    'Reconstrói perímetros por azimute, rumo ou deflexão.',
    'Gerador de perímetro por azimute, rumo ou deflexão, com distância, confrontante, vértices, fechamento e exportações futuras.',
    'Topografia',
    'DraftingCompass',
    '/ferramentas/desenhar-geo',
    'free_beta',
    null,
    null,
    true,
    true,
    false,
    false,
    false,
    60,
    array['Azimute', 'Rumo', 'DXF']
  ),
  (
    'analise-ambiental',
    'Análise Ambiental',
    'Análise ambiental rural por KML/KMZ, camadas ambientais e worker geoespacial.',
    'beta',
    '/ferramentas/analise-ambiental',
    true,
    'Prepara análise ambiental rural por KML, camadas e worker GEO.',
    'Análise ambiental rural por KML/KMZ, vegetação, corpos d''água, drenagens, hidrografia e exportações geoespaciais por worker Python.',
    'Ambiental',
    'Leaf',
    '/ferramentas/analise-ambiental',
    'free_beta',
    null,
    null,
    true,
    true,
    false,
    true,
    true,
    70,
    array['KML', 'MapBiomas', 'ANA']
  )
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  route = excluded.route,
  is_global = excluded.is_global,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  category = excluded.category,
  icon_name = excluded.icon_name,
  route_path = excluded.route_path,
  pricing_mode = excluded.pricing_mode,
  monthly_price_cents = excluded.monthly_price_cents,
  annual_price_cents = excluded.annual_price_cents,
  is_enabled = excluded.is_enabled,
  is_visible = excluded.is_visible,
  is_purchasable = excluded.is_purchasable,
  requires_worker = excluded.requires_worker,
  requires_external_config = excluded.requires_external_config,
  sort_order = excluded.sort_order,
  tags = excluded.tags,
  updated_at = now();

insert into public.organization_modules (organization_id, module_key, enabled, status, source)
select organizations.id, app_modules.key, true, 'active', 'free_beta'
from public.organizations
join public.app_modules
  on app_modules.key in (
    'meu-imovel-car',
    'buscageo',
    'corretor-rtk-ppp',
    'gerador-rw5',
    'portal-cliente',
    'desenhar-geo',
    'analise-ambiental'
  )
on conflict (organization_id, module_key) do update
set
  enabled = true,
  status = 'active',
  source = 'free_beta',
  updated_at = now();

create index if not exists app_modules_visibility_sort_idx
  on public.app_modules(is_visible, is_enabled, sort_order);

create index if not exists app_modules_category_idx
  on public.app_modules(category);

create index if not exists organization_modules_status_idx
  on public.organization_modules(organization_id, status);

notify pgrst, 'reload schema';
