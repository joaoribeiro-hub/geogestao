-- ANALISE-AMBIENTAL-WORKER-1
-- Completa o contrato de jobs da ferramenta Analise Ambiental para o worker Python.

alter table if exists public.module_environmental_analysis_jobs
  add column if not exists geometry_geojson jsonb,
  add column if not exists metric_crs text,
  add column if not exists area_m2 numeric,
  add column if not exists output_storage_paths jsonb not null default '{}'::jsonb,
  add column if not exists result_summary jsonb not null default '{}'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists progress integer not null default 0,
  add column if not exists started_at timestamptz;

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
    'resolvendo_providers',
    'buscando_imagens',
    'processando_vegetacao',
    'processando_agua',
    'processando_drenagem',
    'cruzando_bases',
    'vetorizando',
    'gerando_kml',
    'concluido',
    'completed',
    'erro',
    'failed'
  ));

create index if not exists module_environmental_analysis_jobs_org_progress_idx
  on public.module_environmental_analysis_jobs(organization_id, status, progress);

create index if not exists module_environmental_analysis_jobs_finished_idx
  on public.module_environmental_analysis_jobs(organization_id, finished_at desc)
  where finished_at is not null;

notify pgrst, 'reload schema';
