-- FASE: INTEGRATIONS-AGENTS-TASKS-IMPORT-1
-- Google Drive/Calendar opcionais por usuario, Sophia/agentes, lembretes e importacao Trello.
-- Execute primeiro no Supabase de teste.

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google_drive', 'google_calendar')),
  provider_account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  status text not null default 'active' check (status in ('active', 'disconnected', 'needs_reauthorization', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_integrations_user_org_provider_idx
  on public.user_integrations(user_id, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), provider);

alter table public.documents
  add column if not exists google_drive_file_id text,
  add column if not exists google_drive_owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists google_drive_owner_email text,
  add column if not exists external_url text,
  add column if not exists external_metadata jsonb not null default '{}'::jsonb;

create index if not exists documents_google_drive_file_idx
  on public.documents(organization_id, google_drive_file_id)
  where google_drive_file_id is not null;

create table if not exists public.calendar_event_syncs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  internal_event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google_calendar',
  external_event_id text,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'error', 'skipped', 'deleted')),
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calendar_event_syncs_event_user_provider_idx
  on public.calendar_event_syncs(organization_id, internal_event_id, user_id, provider);

alter table public.agenda_reminders
  add column if not exists notification_preference text not null default 'due'
    check (notification_preference in ('due', '10m', '1h', 'none')),
  add column if not exists completed_at timestamptz;

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  system_prompt text,
  schedule_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  triggered_by uuid references auth.users(id) on delete set null,
  trigger_type text not null default 'manual',
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'error')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  summary text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_agent_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid not null references public.ai_agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_type text not null default 'in_app',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.service_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  source text not null default 'trello',
  filename text,
  total_rows integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  dry_run boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.service_cards
  add column if not exists import_source text,
  add column if not exists import_external_id text,
  add column if not exists import_external_url text,
  add column if not exists imported_at timestamptz,
  add column if not exists imported_by uuid references auth.users(id) on delete set null,
  add column if not exists raw_import_data jsonb;

create unique index if not exists service_cards_org_import_source_external_idx
  on public.service_cards(organization_id, import_source, import_external_id)
  where import_external_id is not null;

insert into public.ai_agents (slug, name, description, system_prompt, schedule_type, is_active)
values
  (
    'briefing-matinal',
    'Briefing da manha',
    'Resume tarefas, lembretes, prazos, atrasos, agenda e urgencias do dia.',
    'Voce e um agente operacional do GeoGestao. Gere um briefing claro, curto e acionavel com base apenas nos dados fornecidos pelo backend.',
    'daily',
    true
  ),
  (
    'revisao-semanal',
    'Revisao semanal',
    'Resume tarefas concluidas, pendencias, servicos movimentados, horas e alertas da semana.',
    'Voce e um agente de revisao semanal do GeoGestao. Gere analise objetiva, sem inventar dados alem do contexto fornecido.',
    'weekly',
    true
  ),
  (
    'documentos',
    'Agente de documentos',
    'Ajuda a organizar documentos e sugerir pendencias por cliente ou servico.',
    'Voce e um agente documental do GeoGestao. Aponte pendencias documentais com cuidado, usando somente os metadados fornecidos.',
    null,
    true
  ),
  (
    'financeiro',
    'Agente financeiro',
    'Analisa entradas, saidas, recebiveis, despesas e lucro estimado/efetuado.',
    'Voce e um agente financeiro do GeoGestao. Resuma riscos e proximos passos, sem aconselhamento financeiro externo.',
    null,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  system_prompt = excluded.system_prompt,
  schedule_type = excluded.schedule_type,
  is_active = excluded.is_active,
  updated_at = now();

drop trigger if exists set_user_integrations_updated_at on public.user_integrations;
create trigger set_user_integrations_updated_at
before update on public.user_integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_event_syncs_updated_at on public.calendar_event_syncs;
create trigger set_calendar_event_syncs_updated_at
before update on public.calendar_event_syncs
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_agents_updated_at on public.ai_agents;
create trigger set_ai_agents_updated_at
before update on public.ai_agents
for each row execute function public.set_updated_at();

alter table public.user_integrations enable row level security;
alter table public.calendar_event_syncs enable row level security;
alter table public.ai_agents enable row level security;
alter table public.ai_agent_runs enable row level security;
alter table public.ai_agent_deliveries enable row level security;
alter table public.service_import_batches enable row level security;

drop policy if exists "user_integrations_select" on public.user_integrations;
create policy "user_integrations_select"
  on public.user_integrations for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      organization_id is not null
      and public.is_org_member(organization_id, auth.uid())
    )
  );

drop policy if exists "user_integrations_insert_own" on public.user_integrations;
create policy "user_integrations_insert_own"
  on public.user_integrations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id, auth.uid()))
  );

drop policy if exists "user_integrations_update_own" on public.user_integrations;
create policy "user_integrations_update_own"
  on public.user_integrations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "calendar_event_syncs_org_select" on public.calendar_event_syncs;
create policy "calendar_event_syncs_org_select"
  on public.calendar_event_syncs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "calendar_event_syncs_org_mutate" on public.calendar_event_syncs;
create policy "calendar_event_syncs_org_mutate"
  on public.calendar_event_syncs for all
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "ai_agents_select" on public.ai_agents;
create policy "ai_agents_select"
  on public.ai_agents for select
  to authenticated
  using (is_active = true);

drop policy if exists "ai_agent_runs_org_select" on public.ai_agent_runs;
create policy "ai_agent_runs_org_select"
  on public.ai_agent_runs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "ai_agent_runs_org_insert" on public.ai_agent_runs;
create policy "ai_agent_runs_org_insert"
  on public.ai_agent_runs for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "ai_agent_deliveries_user_select" on public.ai_agent_deliveries;
create policy "ai_agent_deliveries_user_select"
  on public.ai_agent_deliveries for select
  to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id, auth.uid()));

drop policy if exists "ai_agent_deliveries_org_insert" on public.ai_agent_deliveries;
create policy "ai_agent_deliveries_org_insert"
  on public.ai_agent_deliveries for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "service_import_batches_org_select" on public.service_import_batches;
create policy "service_import_batches_org_select"
  on public.service_import_batches for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "service_import_batches_org_insert" on public.service_import_batches;
create policy "service_import_batches_org_insert"
  on public.service_import_batches for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

notify pgrst, 'reload schema';
