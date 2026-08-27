-- ANALISE-AMBIENTAL-GEE-AUTO-1
-- Permite diferenciar jobs que precisam de exportacao assincrona no Earth Engine.

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
    'export_required',
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

notify pgrst, 'reload schema';
