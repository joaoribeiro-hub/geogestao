-- MODULE-HUB-MIGRATION-2
-- Modulos iniciais funcionais: MeuIMOVEL-CAR, Corretor RTK/PPP e Gerador RW5.

insert into public.app_modules (key, name, description, status, route, is_global)
values
  ('meu-imovel-car', 'MeuIMOVEL-CAR', 'Consulta de imovel rural, CAR, SIGEF/INCRA e alertas.', 'beta', '/modulos/meu-imovel-car', true),
  ('corretor-rtk-ppp', 'Corretor RTK/PPP', 'Correcao linear de pontos rover a partir de base corrigida PPP/IBGE.', 'beta', '/modulos/corretor-rtk-ppp', true),
  ('gerador-rw5', 'Gerador RW5', 'Conversao de arquivos topograficos TXT/PTS/MC/legados para RW5.', 'beta', '/modulos/gerador-rw5', true),
  ('buscageo', 'BuscaGEO', 'Busca e processamento geoespacial de imagens CBERS em migracao para modulo interno.', 'em_migracao', '/modulos/buscageo', true)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  route = excluded.route,
  is_global = excluded.is_global,
  updated_at = now();

insert into public.organization_modules (organization_id, module_key, enabled)
select organizations.id, app_modules.key, true
from public.organizations
join public.app_modules on app_modules.key in ('meu-imovel-car', 'corretor-rtk-ppp', 'gerador-rw5', 'buscageo')
on conflict (organization_id, module_key) do nothing;

create table if not exists public.module_meuimovel_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  query_type text,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.module_meuimovel_saved_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.service_cards(id) on delete set null,
  source text,
  car_code text,
  property_name text,
  owner_name text,
  municipality text,
  uf text,
  area_ha numeric,
  geom_geojson jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_rtk_ppp_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_filename text,
  original_storage_path text,
  result_storage_path text,
  base_raw jsonb not null,
  base_corrected jsonb not null,
  correction jsonb not null,
  rover_count integer not null default 0,
  skipped_lines integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.module_rw5_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_filename text,
  original_storage_path text,
  result_storage_path text,
  input_format text,
  point_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists module_meuimovel_searches_org_created_idx
  on public.module_meuimovel_searches(organization_id, created_at desc);

create index if not exists module_meuimovel_saved_results_org_created_idx
  on public.module_meuimovel_saved_results(organization_id, created_at desc);

create index if not exists module_rtk_ppp_jobs_org_created_idx
  on public.module_rtk_ppp_jobs(organization_id, created_at desc);

create index if not exists module_rw5_jobs_org_created_idx
  on public.module_rw5_jobs(organization_id, created_at desc);

alter table public.module_meuimovel_searches enable row level security;
alter table public.module_meuimovel_saved_results enable row level security;
alter table public.module_rtk_ppp_jobs enable row level security;
alter table public.module_rw5_jobs enable row level security;

drop policy if exists "module_meuimovel_searches_member_select" on public.module_meuimovel_searches;
create policy "module_meuimovel_searches_member_select"
  on public.module_meuimovel_searches for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_meuimovel_searches_member_insert" on public.module_meuimovel_searches;
create policy "module_meuimovel_searches_member_insert"
  on public.module_meuimovel_searches for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "module_meuimovel_saved_results_member_select" on public.module_meuimovel_saved_results;
create policy "module_meuimovel_saved_results_member_select"
  on public.module_meuimovel_saved_results for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_meuimovel_saved_results_member_insert" on public.module_meuimovel_saved_results;
create policy "module_meuimovel_saved_results_member_insert"
  on public.module_meuimovel_saved_results for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_meuimovel_saved_results_owner_delete" on public.module_meuimovel_saved_results;
create policy "module_meuimovel_saved_results_owner_delete"
  on public.module_meuimovel_saved_results for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

drop policy if exists "module_rtk_ppp_jobs_member_select" on public.module_rtk_ppp_jobs;
create policy "module_rtk_ppp_jobs_member_select"
  on public.module_rtk_ppp_jobs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_rtk_ppp_jobs_member_insert" on public.module_rtk_ppp_jobs;
create policy "module_rtk_ppp_jobs_member_insert"
  on public.module_rtk_ppp_jobs for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "module_rtk_ppp_jobs_owner_delete" on public.module_rtk_ppp_jobs;
create policy "module_rtk_ppp_jobs_owner_delete"
  on public.module_rtk_ppp_jobs for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

drop policy if exists "module_rw5_jobs_member_select" on public.module_rw5_jobs;
create policy "module_rw5_jobs_member_select"
  on public.module_rw5_jobs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_rw5_jobs_member_insert" on public.module_rw5_jobs;
create policy "module_rw5_jobs_member_insert"
  on public.module_rw5_jobs for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "module_rw5_jobs_owner_delete" on public.module_rw5_jobs;
create policy "module_rw5_jobs_owner_delete"
  on public.module_rw5_jobs for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

notify pgrst, 'reload schema';
