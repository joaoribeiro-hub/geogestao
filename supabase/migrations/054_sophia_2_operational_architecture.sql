-- SOPHIA 2.0
-- Arquitetura operacional incremental: tools, memoria, eventos, inbox e auditoria.

alter table if exists public.organization_modules
  add column if not exists access_state text not null default 'free',
  add column if not exists billing_mode text not null default 'free',
  add column if not exists access_starts_at timestamptz,
  add column if not exists access_expires_at timestamptz;

alter table if exists public.organization_modules
  drop constraint if exists organization_modules_access_state_check;

alter table if exists public.organization_modules
  add constraint organization_modules_access_state_check
  check (access_state in ('free', 'included', 'trial', 'paid', 'blocked'));

alter table if exists public.organization_modules
  drop constraint if exists organization_modules_billing_mode_check;

alter table if exists public.organization_modules
  add constraint organization_modules_billing_mode_check
  check (billing_mode in ('free', 'included', 'trial', 'paid', 'blocked'));

update public.organization_modules
set access_state = coalesce(access_state, 'free'),
    billing_mode = coalesce(billing_mode, 'free');

create table if not exists public.sophia_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  agent_key text not null default 'coordinator',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'needs_confirmation', 'cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  summary text,
  provider text not null default 'local',
  trace_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sophia_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.sophia_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null,
  tool_version text not null default '1',
  risk_level text not null default 'read'
    check (risk_level in ('read', 'internal_write', 'external_write', 'destructive')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'needs_confirmation', 'cancelled')),
  verified boolean not null default false,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sophia_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_id text not null,
  module_key text,
  is_enabled boolean not null default true,
  allowed_roles text[] not null default array['owner','admin','gerente','tecnico','financeiro','member']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tool_id)
);

create table if not exists public.sophia_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed', 'ignored')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.sophia_memories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null
    check (scope in ('conversation', 'user', 'project', 'service', 'client', 'company', 'document')),
  scope_id uuid,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  importance integer not null default 1,
  source text not null default 'sophia',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.sophia_pending_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.sophia_runs(id) on delete cascade,
  tool_id text not null,
  risk_level text not null default 'internal_write'
    check (risk_level in ('read', 'internal_write', 'external_write', 'destructive')),
  prompt text not null,
  input jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'executed', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sophia_inbox_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  storage_bucket text,
  storage_path text,
  original_name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'classifying', 'needs_confirmation', 'organized', 'error')),
  classification jsonb not null default '{}'::jsonb,
  confidence numeric,
  suggested_entity_type text,
  suggested_entity_id uuid,
  duplicate_of_document_id uuid references public.documents(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sophia_rule_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_key text not null,
  evidence_count integer not null default 1,
  examples jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_key)
);

create index if not exists sophia_runs_org_user_idx on public.sophia_runs(organization_id, user_id, created_at desc);
create index if not exists sophia_runs_agent_idx on public.sophia_runs(organization_id, agent_key, created_at desc);
create index if not exists sophia_tool_calls_run_idx on public.sophia_tool_calls(run_id);
create index if not exists sophia_tool_calls_org_tool_idx on public.sophia_tool_calls(organization_id, tool_id, created_at desc);
create index if not exists sophia_events_org_status_idx on public.sophia_events(organization_id, status, created_at desc);
create index if not exists sophia_memories_org_scope_idx on public.sophia_memories(organization_id, scope, scope_id) where deleted_at is null;
create index if not exists sophia_memories_search_idx on public.sophia_memories using gin (
  to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, ''))
);
create index if not exists sophia_pending_actions_user_idx on public.sophia_pending_actions(organization_id, user_id, status, created_at desc);
create index if not exists sophia_inbox_items_user_idx on public.sophia_inbox_items(organization_id, user_id, created_at desc);
create index if not exists sophia_rule_candidates_org_status_idx on public.sophia_rule_candidates(organization_id, status);

alter table public.sophia_runs enable row level security;
alter table public.sophia_tool_calls enable row level security;
alter table public.sophia_tool_permissions enable row level security;
alter table public.sophia_events enable row level security;
alter table public.sophia_memories enable row level security;
alter table public.sophia_pending_actions enable row level security;
alter table public.sophia_inbox_items enable row level security;
alter table public.sophia_rule_candidates enable row level security;

drop policy if exists "sophia_runs_member_select" on public.sophia_runs;
create policy "sophia_runs_member_select" on public.sophia_runs
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_runs.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_runs_insert_self" on public.sophia_runs;
create policy "sophia_runs_insert_self" on public.sophia_runs
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_runs.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_runs_update_self" on public.sophia_runs;
create policy "sophia_runs_update_self" on public.sophia_runs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sophia_tool_calls_member_select" on public.sophia_tool_calls;
create policy "sophia_tool_calls_member_select" on public.sophia_tool_calls
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_tool_calls.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_tool_calls_insert_self" on public.sophia_tool_calls;
create policy "sophia_tool_calls_insert_self" on public.sophia_tool_calls
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_tool_calls.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_tool_permissions_member_select" on public.sophia_tool_permissions;
create policy "sophia_tool_permissions_member_select" on public.sophia_tool_permissions
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_tool_permissions.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_tool_permissions_owner_write" on public.sophia_tool_permissions;
create policy "sophia_tool_permissions_owner_write" on public.sophia_tool_permissions
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_tool_permissions.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role = 'owner'
    )
  ) with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_tool_permissions.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role = 'owner'
    )
  );

drop policy if exists "sophia_events_member_access" on public.sophia_events;
create policy "sophia_events_member_access" on public.sophia_events
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_events.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  ) with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_events.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_memories_member_access" on public.sophia_memories;
create policy "sophia_memories_member_access" on public.sophia_memories
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_memories.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  ) with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_memories.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_pending_actions_self_access" on public.sophia_pending_actions;
create policy "sophia_pending_actions_self_access" on public.sophia_pending_actions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sophia_inbox_items_member_access" on public.sophia_inbox_items;
create policy "sophia_inbox_items_member_access" on public.sophia_inbox_items
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_inbox_items.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  ) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_inbox_items.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_rule_candidates_member_select" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_member_select" on public.sophia_rule_candidates
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_rule_candidates.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "sophia_rule_candidates_owner_write" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_owner_write" on public.sophia_rule_candidates
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_rule_candidates.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role = 'owner'
    )
  ) with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = sophia_rule_candidates.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role = 'owner'
    )
  );
