-- FASE HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1
-- Inicio operacional, rotina, cronograma, agenda, financeiro, conhecimento da empresa e RH.
-- Execute primeiro no Supabase de teste.

create extension if not exists pgcrypto;

alter table public.checklist_items
  add column if not exists due_date date,
  add column if not exists due_time time,
  add column if not exists scheduled_at timestamptz;

alter table public.agenda_reminders
  add column if not exists category text not null default 'Outro',
  add column if not exists custom_category text,
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurrence_until date,
  add column if not exists canceled_at timestamptz;

alter table public.agenda_reminders
  drop constraint if exists agenda_reminders_recurrence_chk;

alter table public.agenda_reminders
  add constraint agenda_reminders_recurrence_chk
  check (recurrence in ('none', 'weekly'));

alter table public.company_settings
  add column if not exists mission text,
  add column if not exists vision text,
  add column if not exists values_statement text;

alter table public.revenues
  add column if not exists expected_amount numeric,
  add column if not exists realized_amount numeric,
  add column if not exists bank_account text,
  add column if not exists notes text;

alter table public.expenses
  add column if not exists expected_amount numeric,
  add column if not exists realized_amount numeric,
  add column if not exists bank_account text,
  add column if not exists notes text;

update public.revenues
set expected_amount = coalesce(expected_amount, amount),
    realized_amount = coalesce(realized_amount, case when status = 'paid' then amount else null end)
where expected_amount is null
   or (status = 'paid' and realized_amount is null);

update public.expenses
set expected_amount = coalesce(expected_amount, amount),
    realized_amount = coalesce(realized_amount, case when status = 'paid' then amount else null end)
where expected_amount is null
   or (status = 'paid' and realized_amount is null);

create table if not exists public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_bank_account text not null,
  to_bank_account text not null,
  amount numeric not null check (amount > 0),
  transfer_date date not null,
  description text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.company_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.company_knowledge_categories(id) on delete set null,
  title text not null,
  status text not null default 'active',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_knowledge_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.company_knowledge_items(id) on delete cascade,
  title text not null,
  content text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete cascade,
  document_type text not null,
  title text not null,
  document_date date,
  due_date date,
  status text not null default 'active',
  storage_path text,
  file_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  absence_type text not null check (absence_type in ('ferias', 'falta', 'afastamento', 'outro')),
  start_date date not null,
  end_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_birthdays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete cascade,
  name text not null,
  birthday date not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  routine_scope text not null default 'daily'
    check (routine_scope in ('daily', 'weekly', 'monthly', 'annual')),
  routine_date date,
  due_time time,
  status text not null default 'open'
    check (status in ('open', 'done', 'canceled')),
  is_emergency boolean not null default false,
  source text not null default 'routine',
  daily_checklist_item_id uuid references public.daily_checklist_items(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checklist_items_due_date_idx
  on public.checklist_items(due_date, checklist_id);

create index if not exists agenda_reminders_org_category_idx
  on public.agenda_reminders(organization_id, category, reminder_date);

create index if not exists finance_transfers_org_date_idx
  on public.finance_transfers(organization_id, transfer_date);

create index if not exists company_knowledge_items_org_category_idx
  on public.company_knowledge_items(organization_id, category_id);

create index if not exists hr_absences_org_date_idx
  on public.hr_absences(organization_id, start_date, end_date);

create index if not exists hr_birthdays_org_date_idx
  on public.hr_birthdays(organization_id, birthday);

create index if not exists routine_items_org_user_date_idx
  on public.routine_items(organization_id, user_id, routine_scope, routine_date);

alter table public.finance_transfers enable row level security;
alter table public.company_knowledge_categories enable row level security;
alter table public.company_knowledge_items enable row level security;
alter table public.company_knowledge_blocks enable row level security;
alter table public.hr_documents enable row level security;
alter table public.hr_absences enable row level security;
alter table public.hr_birthdays enable row level security;
alter table public.routine_items enable row level security;

drop policy if exists "finance_transfers_org_select" on public.finance_transfers;
create policy "finance_transfers_org_select"
  on public.finance_transfers for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "finance_transfers_org_insert" on public.finance_transfers;
create policy "finance_transfers_org_insert"
  on public.finance_transfers for insert
  to authenticated
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "finance_transfers_org_update" on public.finance_transfers;
create policy "finance_transfers_org_update"
  on public.finance_transfers for update
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "finance_transfers_org_delete" on public.finance_transfers;
create policy "finance_transfers_org_delete"
  on public.finance_transfers for delete
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "company_knowledge_select" on public.company_knowledge_categories;
create policy "company_knowledge_select"
  on public.company_knowledge_categories for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "company_knowledge_mutate" on public.company_knowledge_categories;
create policy "company_knowledge_mutate"
  on public.company_knowledge_categories for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "company_knowledge_items_select" on public.company_knowledge_items;
create policy "company_knowledge_items_select"
  on public.company_knowledge_items for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "company_knowledge_items_mutate" on public.company_knowledge_items;
create policy "company_knowledge_items_mutate"
  on public.company_knowledge_items for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "company_knowledge_blocks_select" on public.company_knowledge_blocks;
create policy "company_knowledge_blocks_select"
  on public.company_knowledge_blocks for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "company_knowledge_blocks_mutate" on public.company_knowledge_blocks;
create policy "company_knowledge_blocks_mutate"
  on public.company_knowledge_blocks for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "hr_documents_select" on public.hr_documents;
create policy "hr_documents_select"
  on public.hr_documents for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "hr_documents_mutate" on public.hr_documents;
create policy "hr_documents_mutate"
  on public.hr_documents for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "hr_absences_select" on public.hr_absences;
create policy "hr_absences_select"
  on public.hr_absences for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "hr_absences_mutate" on public.hr_absences;
create policy "hr_absences_mutate"
  on public.hr_absences for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "hr_birthdays_select" on public.hr_birthdays;
create policy "hr_birthdays_select"
  on public.hr_birthdays for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "hr_birthdays_mutate" on public.hr_birthdays;
create policy "hr_birthdays_mutate"
  on public.hr_birthdays for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "routine_items_select" on public.routine_items;
create policy "routine_items_select"
  on public.routine_items for select
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "routine_items_insert" on public.routine_items;
create policy "routine_items_insert"
  on public.routine_items for insert
  to authenticated
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "routine_items_update" on public.routine_items;
create policy "routine_items_update"
  on public.routine_items for update
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  )
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "routine_items_delete" on public.routine_items;
create policy "routine_items_delete"
  on public.routine_items for delete
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

insert into public.company_knowledge_categories (organization_id, name, slug, position)
select o.id, v.name, v.slug, v.position
from public.organizations o
cross join (
  values
    ('Regras e diretrizes', 'regras-diretrizes', 1),
    ('Cultura', 'cultura', 2),
    ('Acessos', 'acessos', 3),
    ('Reunioes', 'reunioes', 4),
    ('Hierarquia', 'hierarquia', 5)
) as v(name, slug, position)
on conflict (organization_id, slug) do nothing;

notify pgrst, 'reload schema';
