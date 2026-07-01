-- BUSCAGEO-REAL-INTEGRATION-1
-- Integra BuscaGEO real com jobs persistidos, Storage privado e worker FastAPI/GDAL.

alter table if exists public.app_modules
  drop constraint if exists app_modules_status_check;

alter table if exists public.app_modules
  add constraint app_modules_status_check
  check (status in ('ativo', 'beta', 'worker_pendente', 'em_migracao', 'indisponivel'));

insert into public.app_modules (key, name, description, status, route, is_global)
values
  ('buscageo', 'BuscaGEO', 'Busca real de cenas CBERS com worker FastAPI/GDAL, previews, mosaico e GeoTIFF final.', 'beta', '/modulos/buscageo', true)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  route = excluded.route,
  is_global = excluded.is_global,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff',
    'application/x-geotiff',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.google-earth.kml+xml',
    'application/vnd.google-earth.kmz',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit),
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

create table if not exists public.module_buscageo_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft',
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

alter table public.module_buscageo_jobs
  add column if not exists input_mime_type text,
  add column if not exists input_size_bytes bigint,
  add column if not exists bbox jsonb,
  add column if not exists area_ha numeric,
  add column if not exists selected_scenes jsonb not null default '[]'::jsonb,
  add column if not exists output_filename text,
  add column if not exists linked_client_id uuid references public.clients(id) on delete set null,
  add column if not exists linked_service_id uuid references public.service_cards(id) on delete set null,
  add column if not exists linked_document_id uuid,
  add column if not exists started_at timestamptz;

do $$
begin
  if to_regclass('public.documents') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'module_buscageo_jobs_linked_document_id_fkey'
    )
  then
    alter table public.module_buscageo_jobs
      add constraint module_buscageo_jobs_linked_document_id_fkey
      foreign key (linked_document_id) references public.documents(id) on delete set null;
  end if;
end $$;

alter table public.module_buscageo_jobs
  alter column status set default 'draft';

alter table public.module_buscageo_jobs
  drop constraint if exists module_buscageo_jobs_status_check;

alter table public.module_buscageo_jobs
  add constraint module_buscageo_jobs_status_check
  check (status in (
    'draft',
    'uploaded',
    'geometry_ready',
    'searching_scenes',
    'scenes_ready',
    'processing',
    'done',
    'failed',
    'canceled',
    'worker_pending'
  ));

create index if not exists module_buscageo_jobs_org_created_idx
  on public.module_buscageo_jobs(organization_id, created_at desc);

create index if not exists module_buscageo_jobs_org_status_idx
  on public.module_buscageo_jobs(organization_id, status);

create index if not exists module_buscageo_jobs_user_created_idx
  on public.module_buscageo_jobs(user_id, created_at desc);

alter table public.module_buscageo_jobs enable row level security;

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

drop policy if exists "module_buscageo_jobs_member_update" on public.module_buscageo_jobs;
create policy "module_buscageo_jobs_member_update"
  on public.module_buscageo_jobs for update
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_buscageo_jobs_owner_delete" on public.module_buscageo_jobs;
create policy "module_buscageo_jobs_owner_delete"
  on public.module_buscageo_jobs for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

insert into public.organization_modules (organization_id, module_key, enabled)
select organizations.id, 'buscageo', true
from public.organizations
on conflict (organization_id, module_key) do nothing;

notify pgrst, 'reload schema';
