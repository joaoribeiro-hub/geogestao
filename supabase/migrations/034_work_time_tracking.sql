-- FASE WORK-TIME-TRACKING-1
-- Controle operacional de expediente, presenca, intervalos, campo e relatorios de horas.
-- Execute primeiro no Supabase de teste.

create extension if not exists pgcrypto;

alter table public.team_members
  add column if not exists work_schedule_type text not null default '5x2'
    check (work_schedule_type in ('5x2', '6x1', 'custom')),
  add column if not exists expected_minutes_by_weekday jsonb not null default
    '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"0":0}'::jsonb,
  add column if not exists default_work_start time,
  add column if not exists default_work_end time;

create table if not exists public.work_time_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  status text not null default 'active'
    check (status in ('active', 'paused_interval', 'field_mode', 'safety_frozen', 'closed')),
  first_started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_safety_confirmed_at timestamptz not null default now(),
  next_safety_due_at timestamptz not null default (now() + interval '2 hours'),
  safety_grace_until timestamptz not null default (now() + interval '2 hours 15 minutes'),
  total_work_seconds integer not null default 0,
  total_interval_seconds integer not null default 0,
  total_field_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, work_date)
);

create table if not exists public.work_time_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_day_id uuid not null references public.work_time_days(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_seen_at timestamptz not null default now(),
  mode text not null default 'work'
    check (mode in ('work', 'interval', 'field', 'frozen')),
  end_reason text
    check (end_reason is null or end_reason in ('user_interval', 'user_returned', 'page_closed', 'safety_timeout', 'midnight', 'manual', 'field_started', 'field_ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_time_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_day_id uuid not null references public.work_time_days(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.company_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  date date not null,
  name text not null,
  type text not null default 'national'
    check (type in ('national', 'optional_point', 'company', 'state', 'municipal')),
  affects_expected_hours boolean not null default true,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, date, name)
);

create index if not exists work_time_days_org_user_date_idx
  on public.work_time_days(organization_id, user_id, work_date);
create index if not exists work_time_sessions_day_idx
  on public.work_time_sessions(work_day_id, ended_at, mode);
create index if not exists work_time_events_day_idx
  on public.work_time_events(work_day_id, occurred_at);
create index if not exists company_holidays_date_idx
  on public.company_holidays(organization_id, date);
create index if not exists team_members_auth_user_idx
  on public.team_members(organization_id, auth_user_id);

alter table public.work_time_days enable row level security;
alter table public.work_time_sessions enable row level security;
alter table public.work_time_events enable row level security;
alter table public.company_holidays enable row level security;

drop policy if exists "work_time_days_select_self_or_owner" on public.work_time_days;
create policy "work_time_days_select_self_or_owner"
  on public.work_time_days for select
  to authenticated
  using (
    public.is_org_owner(organization_id, auth.uid())
    or (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid())
  );

drop policy if exists "work_time_days_insert_self" on public.work_time_days;
create policy "work_time_days_insert_self"
  on public.work_time_days for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "work_time_days_update_self" on public.work_time_days;
create policy "work_time_days_update_self"
  on public.work_time_days for update
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid())
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "work_time_sessions_select_self_or_owner" on public.work_time_sessions;
create policy "work_time_sessions_select_self_or_owner"
  on public.work_time_sessions for select
  to authenticated
  using (
    public.is_org_owner(organization_id, auth.uid())
    or (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid())
  );

drop policy if exists "work_time_sessions_insert_self" on public.work_time_sessions;
create policy "work_time_sessions_insert_self"
  on public.work_time_sessions for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "work_time_sessions_update_self" on public.work_time_sessions;
create policy "work_time_sessions_update_self"
  on public.work_time_sessions for update
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid())
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "work_time_events_select_self_or_owner" on public.work_time_events;
create policy "work_time_events_select_self_or_owner"
  on public.work_time_events for select
  to authenticated
  using (
    public.is_org_owner(organization_id, auth.uid())
    or (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid())
  );

drop policy if exists "work_time_events_insert_self" on public.work_time_events;
create policy "work_time_events_insert_self"
  on public.work_time_events for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "company_holidays_select_member" on public.company_holidays;
create policy "company_holidays_select_member"
  on public.company_holidays for select
  to authenticated
  using (organization_id is null or public.is_org_member(organization_id, auth.uid()));

drop policy if exists "company_holidays_owner_mutate" on public.company_holidays;
create policy "company_holidays_owner_mutate"
  on public.company_holidays for all
  to authenticated
  using (organization_id is not null and public.is_org_owner(organization_id, auth.uid()))
  with check (organization_id is not null and public.is_org_owner(organization_id, auth.uid()));

insert into public.company_holidays (organization_id, date, name, type, affects_expected_hours)
select null, item.date::date, item.name, item.type, true
from (values
  ('2026-01-01', 'Confraternizacao Universal', 'national'),
  ('2026-02-16', 'Carnaval', 'optional_point'),
  ('2026-02-17', 'Carnaval', 'optional_point'),
  ('2026-04-03', 'Sexta-feira Santa', 'national'),
  ('2026-04-21', 'Tiradentes', 'national'),
  ('2026-05-01', 'Dia do Trabalhador', 'national'),
  ('2026-06-04', 'Corpus Christi', 'optional_point'),
  ('2026-09-07', 'Independencia do Brasil', 'national'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'national'),
  ('2026-11-02', 'Finados', 'national'),
  ('2026-11-15', 'Proclamacao da Republica', 'national'),
  ('2026-11-20', 'Consciencia Negra', 'national'),
  ('2026-12-25', 'Natal', 'national')
) as item(date, name, type)
where not exists (
  select 1
  from public.company_holidays existing
  where existing.organization_id is null
    and existing.date = item.date::date
    and existing.name = item.name
);

notify pgrst, 'reload schema';
