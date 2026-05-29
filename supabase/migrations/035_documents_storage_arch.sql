-- FASE: DOCUMENTS-STORAGE-ARCH-1
-- Documentos profissionais com Supabase Storage privado, quota por organizacao e fila preparada.
-- Execute primeiro no Supabase de teste.

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
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.organizations
  add column if not exists storage_quota_bytes bigint not null default 1073741824,
  add column if not exists storage_used_bytes bigint not null default 0,
  add column if not exists storage_reserved_bytes bigint not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'storage_quota_mb'
  ) then
    update public.organizations
    set storage_quota_bytes = greatest(coalesce(storage_quota_mb, 1024), 1)::bigint * 1024 * 1024
    where storage_quota_bytes = 1073741824
      and storage_quota_mb is not null;
  end if;
end $$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  property_id uuid,
  service_id uuid references public.service_cards(id) on delete set null,
  employee_id uuid references public.team_members(id) on delete set null,
  related_type text,
  related_id uuid,
  uploaded_by uuid references auth.users(id) on delete set null,
  original_name text not null,
  stored_name text,
  document_type text,
  category text,
  title text,
  description text,
  notes text,
  storage_provider text not null default 'supabase_storage',
  storage_bucket text not null default 'documentos',
  storage_path text not null,
  size_bytes bigint not null default 0,
  mime_type text,
  upload_status text not null default 'aguardando_upload',
  processing_status text not null default 'nao_processado',
  processing_error text,
  extracted_text text,
  pages integer,
  file_hash text,
  is_global boolean not null default false,
  is_official boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_upload_status_check check (
    upload_status in ('aguardando_upload', 'enviado', 'erro_upload', 'cancelado', 'removido')
  ),
  constraint documents_processing_status_check check (
    processing_status in ('nao_processado', 'pendente', 'processando', 'concluido', 'erro', 'precisa_ocr')
  ),
  constraint documents_company_or_global_check check (
    (is_global = true) or organization_id is not null
  )
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page integer,
  chunk_index integer not null default 0,
  text text not null,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_processing_jobs_status_check check (
    status in ('pending', 'processing', 'done', 'error', 'canceled')
  )
);

create index if not exists documents_organization_idx on public.documents(organization_id);
create index if not exists documents_client_idx on public.documents(client_id);
create index if not exists documents_property_idx on public.documents(property_id);
create index if not exists documents_service_idx on public.documents(service_id);
create index if not exists documents_employee_idx on public.documents(employee_id);
create index if not exists documents_upload_status_idx on public.documents(upload_status);
create index if not exists documents_processing_status_idx on public.documents(processing_status);
create index if not exists documents_created_at_idx on public.documents(created_at desc);
create index if not exists documents_deleted_at_idx on public.documents(deleted_at);
create index if not exists documents_global_official_idx on public.documents(is_global, is_official);
create unique index if not exists documents_storage_path_unique_idx on public.documents(storage_bucket, storage_path)
  where deleted_at is null;
create index if not exists documents_professional_search_idx on public.documents using gin (
  to_tsvector(
    'portuguese',
    coalesce(original_name, '') || ' ' ||
    coalesce(title, '') || ' ' ||
    coalesce(document_type, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(notes, '') || ' ' ||
    coalesce(extracted_text, '')
  )
);

create index if not exists document_chunks_document_idx on public.document_chunks(document_id);
create index if not exists document_chunks_organization_idx on public.document_chunks(organization_id);
create index if not exists document_chunks_text_idx on public.document_chunks using gin (to_tsvector('portuguese', text));
create index if not exists document_processing_jobs_status_idx
  on public.document_processing_jobs(status, available_at, created_at);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_processing_jobs enable row level security;

drop policy if exists "documents_select_org_or_global" on public.documents;
drop policy if exists "documents_insert_org" on public.documents;
drop policy if exists "documents_update_org" on public.documents;
drop policy if exists "documents_delete_org" on public.documents;

create policy "documents_select_org_or_global" on public.documents
for select to authenticated
using (
  is_global = true
  or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
);

create policy "documents_insert_org" on public.documents
for insert to authenticated
with check (
  is_global = false
  and organization_id is not null
  and public.is_org_member(organization_id, auth.uid())
);

create policy "documents_update_org" on public.documents
for update to authenticated
using (
  is_global = false
  and organization_id is not null
  and public.is_org_member(organization_id, auth.uid())
)
with check (
  is_global = false
  and organization_id is not null
  and public.is_org_member(organization_id, auth.uid())
);

create policy "documents_delete_org" on public.documents
for delete to authenticated
using (
  is_global = false
  and organization_id is not null
  and public.is_org_member(organization_id, auth.uid())
);

drop policy if exists "document_chunks_select_org" on public.document_chunks;
drop policy if exists "document_chunks_insert_org" on public.document_chunks;
drop policy if exists "document_chunks_update_org" on public.document_chunks;
drop policy if exists "document_chunks_delete_org" on public.document_chunks;

create policy "document_chunks_select_org" on public.document_chunks
for select to authenticated
using (public.is_org_member(organization_id, auth.uid()));

create policy "document_chunks_insert_org" on public.document_chunks
for insert to authenticated
with check (public.is_org_member(organization_id, auth.uid()));

create policy "document_chunks_update_org" on public.document_chunks
for update to authenticated
using (public.is_org_member(organization_id, auth.uid()))
with check (public.is_org_member(organization_id, auth.uid()));

create policy "document_chunks_delete_org" on public.document_chunks
for delete to authenticated
using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "document_processing_jobs_select_org" on public.document_processing_jobs;
drop policy if exists "document_processing_jobs_insert_org" on public.document_processing_jobs;
drop policy if exists "document_processing_jobs_update_org" on public.document_processing_jobs;

create policy "document_processing_jobs_select_org" on public.document_processing_jobs
for select to authenticated
using (public.is_org_member(organization_id, auth.uid()));

create policy "document_processing_jobs_insert_org" on public.document_processing_jobs
for insert to authenticated
with check (public.is_org_member(organization_id, auth.uid()));

create policy "document_processing_jobs_update_org" on public.document_processing_jobs
for update to authenticated
using (public.is_org_member(organization_id, auth.uid()))
with check (public.is_org_member(organization_id, auth.uid()));

create or replace function public.reserve_document_storage(
  p_organization_id uuid,
  p_size_bytes bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_size_bytes <= 0 then
    raise exception 'Tamanho de arquivo invalido.';
  end if;

  if not public.is_org_member(p_organization_id, auth.uid()) then
    raise exception 'Usuario sem acesso a organizacao.';
  end if;

  update public.organizations
  set
    storage_reserved_bytes = coalesce(storage_reserved_bytes, 0) + p_size_bytes,
    updated_at = now()
  where id = p_organization_id
    and coalesce(storage_used_bytes, 0) + coalesce(storage_reserved_bytes, 0) + p_size_bytes
      <= coalesce(storage_quota_bytes, 1073741824);

  return found;
end;
$$;

create or replace function public.confirm_document_storage(
  p_organization_id uuid,
  p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_size_bytes <= 0 then
    return;
  end if;

  if not public.is_org_member(p_organization_id, auth.uid()) then
    raise exception 'Usuario sem acesso a organizacao.';
  end if;

  update public.organizations
  set
    storage_reserved_bytes = greatest(coalesce(storage_reserved_bytes, 0) - p_size_bytes, 0),
    storage_used_bytes = coalesce(storage_used_bytes, 0) + p_size_bytes,
    updated_at = now()
  where id = p_organization_id;
end;
$$;

create or replace function public.release_document_storage(
  p_organization_id uuid,
  p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_size_bytes <= 0 then
    return;
  end if;

  if not public.is_org_member(p_organization_id, auth.uid()) then
    raise exception 'Usuario sem acesso a organizacao.';
  end if;

  update public.organizations
  set
    storage_reserved_bytes = greatest(coalesce(storage_reserved_bytes, 0) - p_size_bytes, 0),
    updated_at = now()
  where id = p_organization_id;
end;
$$;

create or replace function public.remove_document_storage(
  p_organization_id uuid,
  p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_size_bytes <= 0 then
    return;
  end if;

  if not public.is_org_member(p_organization_id, auth.uid()) then
    raise exception 'Usuario sem acesso a organizacao.';
  end if;

  update public.organizations
  set
    storage_used_bytes = greatest(coalesce(storage_used_bytes, 0) - p_size_bytes, 0),
    updated_at = now()
  where id = p_organization_id;
end;
$$;

grant execute on function public.reserve_document_storage(uuid, bigint) to authenticated;
grant execute on function public.confirm_document_storage(uuid, bigint) to authenticated;
grant execute on function public.release_document_storage(uuid, bigint) to authenticated;
grant execute on function public.remove_document_storage(uuid, bigint) to authenticated;

drop policy if exists "storage_documentos_select_org" on storage.objects;
drop policy if exists "storage_documentos_insert_org" on storage.objects;
drop policy if exists "storage_documentos_update_org" on storage.objects;
drop policy if exists "storage_documentos_delete_org" on storage.objects;

create policy "storage_documentos_select_org" on storage.objects
for select to authenticated
using (
  bucket_id = 'documentos'
  and name like 'organizations/%'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and name like ('organizations/' || om.organization_id::text || '/%')
  )
);

create policy "storage_documentos_insert_org" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documentos'
  and name like 'organizations/%'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and name like ('organizations/' || om.organization_id::text || '/%')
  )
);

create policy "storage_documentos_update_org" on storage.objects
for update to authenticated
using (
  bucket_id = 'documentos'
  and name like 'organizations/%'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and name like ('organizations/' || om.organization_id::text || '/%')
  )
)
with check (
  bucket_id = 'documentos'
  and name like 'organizations/%'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and name like ('organizations/' || om.organization_id::text || '/%')
  )
);

create policy "storage_documentos_delete_org" on storage.objects
for delete to authenticated
using (
  bucket_id = 'documentos'
  and name like 'organizations/%'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and name like ('organizations/' || om.organization_id::text || '/%')
  )
);

notify pgrst, 'reload schema';
