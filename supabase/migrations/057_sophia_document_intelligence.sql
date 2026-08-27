-- SOPHIA-DOCUMENT-INTELLIGENCE-OCR-RAG-1
-- Extensao incremental para processamento local, OCR sob demanda e busca citavel.

alter table public.document_chunks
  add column if not exists content text,
  add column if not exists page_start integer,
  add column if not exists page_end integer,
  add column if not exists heading text,
  add column if not exists content_hash text,
  add column if not exists token_estimate integer,
  add column if not exists order_index integer,
  add column if not exists extraction_method text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.document_chunks
set content = text
where content is null;

alter table public.sophia_inbox_items
  drop constraint if exists sophia_inbox_items_status_check;

alter table public.sophia_inbox_items
  add constraint sophia_inbox_items_status_check check (
    status in ('uploaded', 'needs_processing', 'processing', 'processed', 'failed', 'classifying', 'needs_confirmation', 'organized', 'error')
  );

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  inbox_item_id uuid references public.sophia_inbox_items(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_bucket text not null default 'documentos',
  storage_path text,
  file_name text,
  mime_type text,
  status text not null default 'pending',
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  extraction_provider text,
  ocr_provider text,
  pages_total integer,
  pages_ocr integer not null default 0,
  chunks_total integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_processing_jobs_status_v2_check check (
    status in ('pending', 'processing', 'done', 'error', 'canceled')
  )
);

-- A migration anterior pode ter criado esta tabela com document_id obrigatório.
alter table public.document_processing_jobs
  alter column document_id drop not null;

alter table public.document_processing_jobs
  add column if not exists inbox_item_id uuid references public.sophia_inbox_items(id) on delete cascade,
  add column if not exists storage_bucket text default 'documentos',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists progress integer default 0,
  add column if not exists error_message text,
  add column if not exists extraction_provider text,
  add column if not exists ocr_provider text,
  add column if not exists pages_total integer,
  add column if not exists pages_ocr integer default 0,
  add column if not exists chunks_total integer default 0,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

create table if not exists public.document_extracted_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer not null,
  extraction_method text not null check (extraction_method in ('native', 'ocr', 'mixed')),
  text text not null default '',
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create table if not exists public.document_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  provider text not null default 'local_extractive',
  model text,
  summary text not null,
  document_type text,
  entities jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  confidence numeric,
  needs_confirmation boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sophia_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.service_cards(id) on delete set null,
  link_type text not null default 'suggested',
  confidence numeric,
  status text not null default 'suggested' check (status in ('suggested', 'confirmed', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists document_chunks_content_hash_idx on public.document_chunks(document_id, content_hash);
create index if not exists document_chunks_order_idx on public.document_chunks(document_id, order_index);
create index if not exists document_chunks_fts_idx on public.document_chunks using gin (
  to_tsvector('portuguese', coalesce(content, text, ''))
);
create index if not exists document_pages_org_doc_idx on public.document_extracted_pages(organization_id, document_id, page_number);
create index if not exists document_ai_summaries_org_doc_idx on public.document_ai_summaries(organization_id, document_id, created_at desc);
create index if not exists sophia_document_links_org_doc_idx on public.sophia_document_links(organization_id, document_id);
create index if not exists document_jobs_status_progress_idx on public.document_processing_jobs(organization_id, status, created_at desc);

alter table public.document_extracted_pages enable row level security;
alter table public.document_ai_summaries enable row level security;
alter table public.sophia_document_links enable row level security;

drop policy if exists "document_pages_member_access" on public.document_extracted_pages;
create policy "document_pages_member_access" on public.document_extracted_pages
for all to authenticated
using (public.is_org_member(organization_id, auth.uid()))
with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "document_summaries_member_access" on public.document_ai_summaries;
create policy "document_summaries_member_access" on public.document_ai_summaries
for all to authenticated
using (public.is_org_member(organization_id, auth.uid()))
with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "document_links_member_access" on public.sophia_document_links;
create policy "document_links_member_access" on public.sophia_document_links
for all to authenticated
using (public.is_org_member(organization_id, auth.uid()))
with check (public.is_org_member(organization_id, auth.uid()));

create or replace function public.match_document_chunks(
  p_organization_id uuid,
  p_query text,
  p_limit integer default 8,
  p_document_id uuid default null,
  p_client_id uuid default null,
  p_service_id uuid default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  original_name text,
  page_start integer,
  page_end integer,
  content_snippet text,
  score real,
  source text
)
language sql
security definer
set search_path = public
stable
as $$
  with requested as (
    select greatest(1, least(coalesce(p_limit, 8), 50)) as lim,
           nullif(trim(coalesce(p_query, '')), '') as query_text
  ), candidates as (
    select
      dc.id as chunk_id,
      dc.document_id,
      d.title,
      d.original_name,
      coalesce(dc.page_start, dc.page) as page_start,
      coalesce(dc.page_end, dc.page) as page_end,
      left(coalesce(dc.content, dc.text, ''), 1200) as content_snippet,
      case
        when requested.query_text is null then 0.1::real
        else ts_rank(
          to_tsvector('portuguese', coalesce(dc.content, dc.text, '')),
          plainto_tsquery('portuguese', requested.query_text)
        )::real
      end as score,
      coalesce(dc.source, dc.extraction_method, 'document') as source
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    cross join requested
    where dc.organization_id = p_organization_id
      and d.organization_id = p_organization_id
      and d.deleted_at is null
      and public.is_org_member(p_organization_id, auth.uid())
      and (p_document_id is null or d.id = p_document_id)
      and (p_client_id is null or d.client_id = p_client_id)
      and (p_service_id is null or d.service_id = p_service_id)
      and (
        requested.query_text is null
        or to_tsvector('portuguese', coalesce(dc.content, dc.text, '')) @@ plainto_tsquery('portuguese', requested.query_text)
        or coalesce(dc.content, dc.text, '') ilike '%' || requested.query_text || '%'
      )
  )
  select candidates.*
  from candidates
  order by score desc, document_id, page_start nulls last, chunk_id
  limit (select lim from requested);
$$;

grant execute on function public.match_document_chunks(uuid, text, integer, uuid, uuid, uuid) to authenticated;
