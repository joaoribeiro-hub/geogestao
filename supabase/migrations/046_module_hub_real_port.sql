-- MODULE-HUB-REAL-PORT-1
-- Complemento incremental para telas reais de modulos, jobs BuscaGEO e metadados RW5.

alter table if exists public.app_modules
  drop constraint if exists app_modules_status_check;

alter table if exists public.app_modules
  add constraint app_modules_status_check
  check (status in ('ativo', 'beta', 'worker_pendente', 'em_migracao', 'indisponivel'));

insert into public.app_modules (key, name, description, status, route, is_global)
values
  ('meu-imovel-car', 'MeuIMOVEL-CAR', 'Consulta operacional de CAR, imoveis, historico e bases GeoQuery.', 'beta', '/modulos/meu-imovel-car', true),
  ('buscageo', 'BuscaGEO', 'Upload de poligono, parametros CBERS, jobs persistidos e contrato para worker GDAL.', 'worker_pendente', '/modulos/buscageo', true),
  ('corretor-rtk-ppp', 'Corretor RTK/PPP', 'Correcao linear de pontos rover por delta entre base levantada e base corrigida.', 'beta', '/modulos/corretor-rtk-ppp', true),
  ('gerador-rw5', 'Gerador RW5', 'Conversao beta de arquivos topograficos TXT/PTS/MC/legados para RW5.', 'beta', '/modulos/gerador-rw5', true)
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
join public.app_modules on app_modules.key in ('meu-imovel-car', 'buscageo', 'corretor-rtk-ppp', 'gerador-rw5')
on conflict (organization_id, module_key) do nothing;

alter table if exists public.module_rw5_jobs
  add column if not exists output_filename text,
  add column if not exists crs text default 'EPSG:31982',
  add column if not exists equipment text,
  add column if not exists antenna_rw5 text,
  add column if not exists hr_offset numeric,
  add column if not exists base_count integer not null default 0;

create table if not exists public.module_buscageo_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  input_filename text,
  input_storage_path text,
  output_storage_path text,
  preview_storage_path text,
  geometry jsonb,
  parameters jsonb not null default '{}'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.module_meu_imovel_queries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  query_type text,
  query_value text,
  result jsonb not null default '{}'::jsonb,
  linked_client_id uuid references public.clients(id) on delete set null,
  linked_service_id uuid references public.service_cards(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.module_meu_imovel_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  query_id uuid references public.module_meu_imovel_queries(id) on delete cascade,
  alert_type text,
  title text not null,
  description text,
  severity text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists module_buscageo_jobs_org_created_idx
  on public.module_buscageo_jobs(organization_id, created_at desc);

create index if not exists module_meu_imovel_queries_org_created_idx
  on public.module_meu_imovel_queries(organization_id, created_at desc);

create index if not exists module_meu_imovel_alerts_org_created_idx
  on public.module_meu_imovel_alerts(organization_id, created_at desc);

alter table public.module_buscageo_jobs enable row level security;
alter table public.module_meu_imovel_queries enable row level security;
alter table public.module_meu_imovel_alerts enable row level security;

drop policy if exists "module_buscageo_jobs_member_select" on public.module_buscageo_jobs;
create policy "module_buscageo_jobs_member_select"
  on public.module_buscageo_jobs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_buscageo_jobs_member_insert" on public.module_buscageo_jobs;
create policy "module_buscageo_jobs_member_insert"
  on public.module_buscageo_jobs for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "module_buscageo_jobs_owner_delete" on public.module_buscageo_jobs;
create policy "module_buscageo_jobs_owner_delete"
  on public.module_buscageo_jobs for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

drop policy if exists "module_meu_imovel_queries_member_select" on public.module_meu_imovel_queries;
create policy "module_meu_imovel_queries_member_select"
  on public.module_meu_imovel_queries for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_meu_imovel_queries_member_insert" on public.module_meu_imovel_queries;
create policy "module_meu_imovel_queries_member_insert"
  on public.module_meu_imovel_queries for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "module_meu_imovel_alerts_member_select" on public.module_meu_imovel_alerts;
create policy "module_meu_imovel_alerts_member_select"
  on public.module_meu_imovel_alerts for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_meu_imovel_alerts_member_insert" on public.module_meu_imovel_alerts;
create policy "module_meu_imovel_alerts_member_insert"
  on public.module_meu_imovel_alerts for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

notify pgrst, 'reload schema';
