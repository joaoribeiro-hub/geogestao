-- Plataforma tecnica e conteudo universal do GeoGestao.
-- Incremental sobre 019, 054, 058 e 059.

create table if not exists public.platform_developers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  role text not null default 'developer' check (role in ('developer', 'platform_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists platform_developers_user_idx
  on public.platform_developers(user_id) where is_active = true;

alter table public.platform_developers enable row level security;

create or replace function public.is_platform_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_developers pd
    where pd.user_id = auth.uid()
      and pd.is_active = true
      and pd.role in ('developer', 'platform_admin')
  );
$$;

revoke all on function public.is_platform_developer() from public;
grant execute on function public.is_platform_developer() to authenticated;

-- Compatibilidade: o antigo admin global passa a significar desenvolvedor da plataforma.
create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_developer();
$$;

drop policy if exists "platform_developers_own_select" on public.platform_developers;
create policy "platform_developers_own_select" on public.platform_developers
for select to authenticated
using (user_id = auth.uid() and is_active = true);

drop policy if exists "platform_developers_platform_write" on public.platform_developers;
create policy "platform_developers_platform_write" on public.platform_developers
for all to authenticated
using (public.is_platform_developer())
with check (public.is_platform_developer());

create table if not exists public.universal_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in ('legislacao', 'anexos')),
  storage_bucket text not null default 'attachments',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0 and file_size <= 52428800),
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists universal_documents_category_active_idx
  on public.universal_documents(category, is_active, published_at desc);

alter table public.universal_documents enable row level security;

drop policy if exists "universal_documents_authenticated_read" on public.universal_documents;
create policy "universal_documents_authenticated_read" on public.universal_documents
for select to authenticated
using (
  (is_active = true and published_at <= now())
  or public.is_platform_developer()
);

drop policy if exists "universal_documents_platform_write" on public.universal_documents;
create policy "universal_documents_platform_write" on public.universal_documents
for all to authenticated
using (public.is_platform_developer())
with check (public.is_platform_developer() and created_by = auth.uid());

create table if not exists public.universal_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  attachment_bucket text,
  attachment_path text unique,
  attachment_file_name text,
  attachment_mime_type text,
  attachment_size bigint check (attachment_size is null or (attachment_size >= 0 and attachment_size <= 52428800)),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists universal_announcements_active_dates_idx
  on public.universal_announcements(is_active, starts_at desc, ends_at);

alter table public.universal_announcements enable row level security;

drop policy if exists "universal_announcements_authenticated_read" on public.universal_announcements;
create policy "universal_announcements_authenticated_read" on public.universal_announcements
for select to authenticated
using (
  (is_active = true and starts_at <= now() and (ends_at is null or ends_at > now()))
  or public.is_platform_developer()
);

drop policy if exists "universal_announcements_platform_write" on public.universal_announcements;
create policy "universal_announcements_platform_write" on public.universal_announcements
for all to authenticated
using (public.is_platform_developer())
with check (public.is_platform_developer() and created_by = auth.uid());

create table if not exists public.universal_announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.universal_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists universal_announcement_reads_user_idx
  on public.universal_announcement_reads(user_id, announcement_id);

alter table public.universal_announcement_reads enable row level security;

drop policy if exists "universal_announcement_reads_own" on public.universal_announcement_reads;
create policy "universal_announcement_reads_own" on public.universal_announcement_reads
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.platform_sophia_rules (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id uuid references public.sophia_rule_candidates(id) on delete set null,
  rule_key text not null unique,
  sanitized_content text not null,
  evidence_count integer not null default 1 check (evidence_count > 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'rejected')),
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_sophia_rules enable row level security;

drop policy if exists "platform_sophia_rules_authenticated_read" on public.platform_sophia_rules;
create policy "platform_sophia_rules_authenticated_read" on public.platform_sophia_rules
for select to authenticated using (status = 'active' or public.is_platform_developer());

drop policy if exists "platform_sophia_rules_platform_write" on public.platform_sophia_rules;
create policy "platform_sophia_rules_platform_write" on public.platform_sophia_rules
for all to authenticated
using (public.is_platform_developer())
with check (public.is_platform_developer() and approved_by = auth.uid());

alter table if exists public.sophia_rule_candidates
  add column if not exists scope text not null default 'organization',
  add column if not exists sanitized_rule text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table if exists public.sophia_rule_candidates
  drop constraint if exists sophia_rule_candidates_scope_check;
alter table if exists public.sophia_rule_candidates
  add constraint sophia_rule_candidates_scope_check
  check (scope in ('organization', 'global_candidate'));

create index if not exists sophia_rule_candidates_global_status_idx
  on public.sophia_rule_candidates(scope, status, updated_at desc);

-- Candidatos organizacionais continuam privados. Candidatos globais so aparecem
-- na fila tecnica da plataforma, mesmo para o owner que originou o feedback.
drop policy if exists "sophia_rule_candidates_member_select" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_member_select" on public.sophia_rule_candidates
for select to authenticated
using (
  scope = 'organization'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = sophia_rule_candidates.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists "sophia_rule_candidates_owner_write" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_owner_write" on public.sophia_rule_candidates
for all to authenticated
using (
  scope = 'organization'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = sophia_rule_candidates.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role = 'owner'
  )
)
with check (
  scope = 'organization'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = sophia_rule_candidates.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role = 'owner'
  )
);

drop policy if exists "sophia_rule_candidates_member_insert" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_member_insert" on public.sophia_rule_candidates
for insert to authenticated
with check (
  created_by = auth.uid()
  and scope = 'organization'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = sophia_rule_candidates.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists "sophia_rule_candidates_submitter_update" on public.sophia_rule_candidates;

create or replace function public.submit_sophia_global_candidate(
  p_organization_id uuid,
  p_rule_key text,
  p_evidence_count integer,
  p_examples jsonb,
  p_sanitized_rule text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  ) then
    raise exception 'Acesso negado';
  end if;
  if nullif(trim(p_rule_key), '') is null or nullif(trim(p_sanitized_rule), '') is null then
    raise exception 'Candidato global invalido';
  end if;

  insert into public.sophia_rule_candidates (
    organization_id, rule_key, evidence_count, examples, status,
    scope, sanitized_rule, created_by, updated_at
  ) values (
    p_organization_id, left(p_rule_key, 180), greatest(p_evidence_count, 1),
    coalesce(p_examples, '[]'::jsonb), 'pending', 'global_candidate',
    left(p_sanitized_rule, 12000), auth.uid(), now()
  )
  on conflict (organization_id, rule_key) do update set
    evidence_count = greatest(public.sophia_rule_candidates.evidence_count, excluded.evidence_count),
    examples = excluded.examples,
    sanitized_rule = excluded.sanitized_rule,
    updated_at = now()
  where public.sophia_rule_candidates.scope = 'global_candidate'
    and public.sophia_rule_candidates.status = 'pending'
  returning id into candidate_id;

  if candidate_id is null then
    select src.id into candidate_id
    from public.sophia_rule_candidates src
    where src.organization_id = p_organization_id
      and src.rule_key = left(p_rule_key, 180)
      and src.scope = 'global_candidate';
  end if;
  return candidate_id;
end;
$$;

revoke all on function public.submit_sophia_global_candidate(uuid, text, integer, jsonb, text) from public;
grant execute on function public.submit_sophia_global_candidate(uuid, text, integer, jsonb, text) to authenticated;

drop policy if exists "sophia_rule_candidates_platform_select" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_platform_select" on public.sophia_rule_candidates
for select to authenticated
using (scope = 'global_candidate' and public.is_platform_developer());

drop policy if exists "sophia_rule_candidates_platform_update" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_platform_update" on public.sophia_rule_candidates
for update to authenticated
using (scope = 'global_candidate' and public.is_platform_developer())
with check (scope = 'global_candidate' and public.is_platform_developer());

-- Evals e aprovacoes sao infraestrutura da plataforma, nao configuracao da empresa.
drop policy if exists "sophia_eval_cases_owner_access" on public.sophia_eval_cases;
drop policy if exists "sophia_eval_cases_technical_access" on public.sophia_eval_cases;
create policy "sophia_eval_cases_platform_access" on public.sophia_eval_cases
for all to authenticated
using (public.is_platform_developer())
with check (public.is_platform_developer());

drop policy if exists "sophia_eval_runs_owner_access" on public.sophia_eval_runs;
drop policy if exists "sophia_eval_runs_technical_access" on public.sophia_eval_runs;
create policy "sophia_eval_runs_platform_access" on public.sophia_eval_runs
for all to authenticated
using (public.is_platform_developer())
with check (public.is_platform_developer());

drop policy if exists "sophia_rule_approvals_owner" on public.sophia_rule_approvals;
create policy "sophia_rule_approvals_platform" on public.sophia_rule_approvals
for all to authenticated
using (public.is_platform_developer())
with check (public.is_platform_developer() and approved_by = auth.uid());

-- Objetos universais continuam no bucket privado attachments.
drop policy if exists "storage_universal_content_read" on storage.objects;
create policy "storage_universal_content_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    public.is_platform_developer()
    or exists (
      select 1 from public.universal_documents ud
      where ud.storage_bucket = bucket_id
        and ud.storage_path = name
        and ud.is_active = true
        and ud.published_at <= now()
    )
    or exists (
      select 1 from public.universal_announcements ua
      where ua.attachment_bucket = bucket_id
        and ua.attachment_path = name
        and ua.is_active = true
        and ua.starts_at <= now()
        and (ua.ends_at is null or ua.ends_at > now())
    )
  )
);

drop policy if exists "storage_universal_content_insert" on storage.objects;
create policy "storage_universal_content_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and public.is_platform_developer()
  and (name like 'global/universal-documents/%' or name like 'global/universal-announcements/%')
);

drop policy if exists "storage_universal_content_update" on storage.objects;
create policy "storage_universal_content_update" on storage.objects
for update to authenticated
using (bucket_id = 'attachments' and public.is_platform_developer() and name like 'global/universal-%')
with check (bucket_id = 'attachments' and public.is_platform_developer() and name like 'global/universal-%');

drop policy if exists "storage_universal_content_delete" on storage.objects;
create policy "storage_universal_content_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'attachments' and public.is_platform_developer() and name like 'global/universal-%');

notify pgrst, 'reload schema';
