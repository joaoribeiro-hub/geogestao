-- ANALISE-AMBIENTAL-FUSAO-CAR-MAPBIOMAS-MOTOR-VEGETACAO-1
-- Registra fontes multifonte, imagem atual e amostras auditaveis para treino futuro.

alter table if exists public.module_environmental_analysis_jobs
  add column if not exists requested_sources text[] not null default array['mapbiomas']::text[],
  add column if not exists source_options jsonb not null default '{}'::jsonb,
  add column if not exists current_image_source text,
  add column if not exists current_image_storage_path text,
  add column if not exists source_manifest_version text,
  add column if not exists fusion_summary jsonb not null default '{}'::jsonb,
  add column if not exists training_summary jsonb not null default '{}'::jsonb;

alter table if exists public.module_environmental_analysis_jobs
  drop constraint if exists module_environmental_analysis_jobs_status_check;

alter table if exists public.module_environmental_analysis_jobs
  add constraint module_environmental_analysis_jobs_status_check
  check (status in (
    'aguardando', 'worker_pendente', 'worker_pending', 'lendo_area', 'reading_aoi',
    'limite_extraido', 'resolvendo_providers', 'resolvendo_fontes', 'provider_pendente',
    'export_required', 'buscando_imagens', 'processando_mapbiomas', 'processando_car',
    'processando_imagem_atual', 'processando_vegetacao', 'processando_agua',
    'processando_drenagem', 'processando_hidrografia', 'cruzando_bases',
    'fundindo_fontes', 'gerando_amostras', 'vetorizando', 'gerando_kml',
    'gerando_outputs', 'simulado', 'concluido', 'completed', 'erro', 'failed'
  ));

create index if not exists environmental_jobs_current_image_idx
  on public.module_environmental_analysis_jobs(organization_id, current_image_source, created_at desc)
  where current_image_storage_path is not null;

create table if not exists public.environmental_training_samples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.module_environmental_analysis_jobs(id) on delete cascade,
  source_layer text not null,
  final_class text not null,
  geometry jsonb,
  storage_path text,
  raster_storage_path text,
  aoi_storage_path text,
  label_source text not null default 'consensus_auto'
    check (label_source in ('consensus_auto', 'user_validated', 'user_corrected', 'expert_validated')),
  confidence_score numeric not null default 0
    check (confidence_score >= 0 and confidence_score <= 1),
  confidence_tier text not null default 'BRONZE'
    check (confidence_tier in ('GOLD', 'SILVER', 'BRONZE', 'DISPUTED')),
  validation_status text not null default 'candidate'
    check (validation_status in ('candidate', 'approved', 'rejected', 'corrected')),
  corrected_class text,
  notes text,
  fingerprint text,
  created_by uuid not null,
  validated_by uuid,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

drop index if exists public.environmental_training_samples_fingerprint_uidx;
create unique index environmental_training_samples_fingerprint_uidx
  on public.environmental_training_samples(organization_id, job_id, fingerprint);

create index if not exists environmental_training_samples_org_created_idx
  on public.environmental_training_samples(organization_id, created_at desc);

create index if not exists environmental_training_samples_job_idx
  on public.environmental_training_samples(job_id, confidence_tier, validation_status);

alter table public.environmental_training_samples enable row level security;

drop policy if exists "environmental_training_samples_member_select" on public.environmental_training_samples;
create policy "environmental_training_samples_member_select"
  on public.environmental_training_samples for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "environmental_training_samples_member_insert" on public.environmental_training_samples;
create policy "environmental_training_samples_member_insert"
  on public.environmental_training_samples for insert
  to authenticated
  with check (
    public.is_org_member(organization_id, auth.uid())
    and created_by = auth.uid()
  );

drop policy if exists "environmental_training_samples_member_update" on public.environmental_training_samples;
create policy "environmental_training_samples_member_update"
  on public.environmental_training_samples for update
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (created_by = auth.uid() or public.is_org_owner_or_admin(organization_id, auth.uid()))
  )
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "environmental_training_samples_owner_delete" on public.environmental_training_samples;
create policy "environmental_training_samples_owner_delete"
  on public.environmental_training_samples for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

notify pgrst, 'reload schema';
