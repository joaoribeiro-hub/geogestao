-- FASE AI-ASSISTANT-INTENTS-1
-- Base privada/admin de exemplos de intents para o Assistente IA.
-- Execute primeiro no Supabase de teste.

create extension if not exists pg_trgm;

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

alter table public.assistant_intents
  add column if not exists category text,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_assistant_intents_updated_at on public.assistant_intents;
create trigger set_assistant_intents_updated_at
before update on public.assistant_intents
for each row execute function public.set_updated_at();

create table if not exists public.assistant_intent_examples (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.assistant_intents(id) on delete cascade,
  raw_text text not null,
  normalized_text text not null,
  source text not null default 'geogestao_assistente_frases',
  source_file text,
  source_line integer,
  synonym text,
  params_sample jsonb not null default '{}',
  entities_sample jsonb not null default '{}',
  requires_confirmation boolean,
  confidence numeric,
  is_real_data boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_dataset_imports (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_hash text,
  total_lines integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  duplicate_count integer not null default 0,
  unknown_count integer not null default 0,
  imported_at timestamptz not null default now(),
  notes text
);

drop trigger if exists set_assistant_intent_examples_updated_at on public.assistant_intent_examples;
create trigger set_assistant_intent_examples_updated_at
before update on public.assistant_intent_examples
for each row execute function public.set_updated_at();

create unique index if not exists assistant_intent_examples_unique_source_idx
  on public.assistant_intent_examples(intent_id, normalized_text, source);

create index if not exists assistant_intent_examples_intent_idx
  on public.assistant_intent_examples(intent_id, is_active, created_at desc);

create index if not exists assistant_intent_examples_normalized_trgm_idx
  on public.assistant_intent_examples using gin (normalized_text gin_trgm_ops);

create index if not exists assistant_dataset_imports_hash_idx
  on public.assistant_dataset_imports(source_hash);

alter table public.assistant_intent_examples enable row level security;
alter table public.assistant_dataset_imports enable row level security;

drop policy if exists "assistant_intent_examples_select_active" on public.assistant_intent_examples;
drop policy if exists "assistant_intent_examples_admin_select" on public.assistant_intent_examples;
create policy "assistant_intent_examples_admin_select"
  on public.assistant_intent_examples for select
  to authenticated
  using (public.is_global_admin());

drop policy if exists "assistant_intent_examples_admin_all" on public.assistant_intent_examples;
create policy "assistant_intent_examples_admin_all"
  on public.assistant_intent_examples for all
  to authenticated
  using (public.is_global_admin())
  with check (public.is_global_admin());

drop policy if exists "assistant_dataset_imports_admin_select" on public.assistant_dataset_imports;
create policy "assistant_dataset_imports_admin_select"
  on public.assistant_dataset_imports for select
  to authenticated
  using (public.is_global_admin());

drop policy if exists "assistant_dataset_imports_admin_insert" on public.assistant_dataset_imports;
create policy "assistant_dataset_imports_admin_insert"
  on public.assistant_dataset_imports for insert
  to authenticated
  with check (public.is_global_admin());

create or replace function public.find_assistant_intent_examples(
  p_normalized_text text,
  p_limit integer default 8
)
returns table (
  raw_text text,
  normalized_text text,
  synonym text,
  intent_name text,
  action_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with tokens as (
    select token
    from unnest(regexp_split_to_array(coalesce(p_normalized_text, ''), '\s+')) as token
    where length(token) >= 4
    limit 8
  )
  select
    e.raw_text,
    e.normalized_text,
    e.synonym,
    i.name as intent_name,
    i.action_name
  from public.assistant_intent_examples e
  join public.assistant_intents i on i.id = e.intent_id
  where e.is_active = true
    and i.enabled = true
    and exists (
      select 1
      from tokens t
      where e.normalized_text ilike '%' || t.token || '%'
    )
  order by similarity(e.normalized_text, coalesce(p_normalized_text, '')) desc, e.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.find_assistant_intent_examples(text, integer) from public;
grant execute on function public.find_assistant_intent_examples(text, integer) to authenticated;

notify pgrst, 'reload schema';
