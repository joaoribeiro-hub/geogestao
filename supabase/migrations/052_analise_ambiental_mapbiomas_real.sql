-- ANALISE-AMBIENTAL-MAPBIOMAS-REAL-1
-- Permite informar um GeoTIFF MapBiomas por job e diferencia resultado simulado de resultado real.

alter table if exists public.module_environmental_analysis_jobs
  add column if not exists input_raster_storage_path text;

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
    'processando_mapbiomas',
    'cruzando_bases',
    'vetorizando',
    'gerando_kml',
    'gerando_outputs',
    'simulado',
    'concluido',
    'completed',
    'erro',
    'failed'
  ));

create index if not exists module_environmental_analysis_jobs_raster_idx
  on public.module_environmental_analysis_jobs(organization_id, input_raster_storage_path)
  where input_raster_storage_path is not null;

notify pgrst, 'reload schema';
