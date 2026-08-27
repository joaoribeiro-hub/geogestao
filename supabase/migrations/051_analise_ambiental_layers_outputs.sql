-- ANALISE-AMBIENTAL-WORKER-2-CAMADAS-E-OUTPUTS
-- Registra outputs por camada/formato e amplia os status do worker ambiental.

alter table if exists public.module_environmental_analysis_jobs
  drop constraint if exists module_environmental_analysis_jobs_status_check;

alter table if exists public.module_environmental_analysis_jobs
  add constraint module_environmental_analysis_jobs_status_check
  check (status in (
    'aguardando',
    'worker_pendente',
    'worker_pending',
    'lendo_area',
    'reading_aoi',
    'limite_extraido',
    'resolvendo_providers',
    'provider_pendente',
    'buscando_imagens',
    'processando_vegetacao',
    'processando_agua',
    'processando_drenagem',
    'cruzando_bases',
    'vetorizando',
    'gerando_kml',
    'gerando_outputs',
    'concluido',
    'completed',
    'erro',
    'failed'
  ));

create table if not exists public.environmental_analysis_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.module_environmental_analysis_jobs(id) on delete cascade,
  layer_key text not null,
  layer_name text not null,
  output_format text not null,
  storage_bucket text not null default 'documentos',
  storage_path text not null,
  file_name text not null,
  area_ha numeric,
  length_m numeric,
  confidence text,
  provider text,
  official_data boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, job_id, layer_key, output_format)
);

create index if not exists environmental_analysis_outputs_job_idx
  on public.environmental_analysis_outputs(job_id, layer_key, output_format);

create index if not exists environmental_analysis_outputs_org_job_idx
  on public.environmental_analysis_outputs(organization_id, job_id);

alter table public.environmental_analysis_outputs enable row level security;

drop policy if exists "environmental_outputs_member_select" on public.environmental_analysis_outputs;
create policy "environmental_outputs_member_select"
  on public.environmental_analysis_outputs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "environmental_outputs_member_insert" on public.environmental_analysis_outputs;
create policy "environmental_outputs_member_insert"
  on public.environmental_analysis_outputs for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "environmental_outputs_member_update" on public.environmental_analysis_outputs;
create policy "environmental_outputs_member_update"
  on public.environmental_analysis_outputs for update
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

notify pgrst, 'reload schema';
