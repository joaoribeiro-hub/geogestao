-- FASE UX-ORG-SERVICES-1 - correcao de workflow por tipo, equipe e permissoes.
-- Execute primeiro no Supabase de teste.

create or replace function public.is_organization_manager(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

alter table if exists public.company_settings
  add column if not exists bank_name text,
  add column if not exists bank_agency text,
  add column if not exists bank_account text,
  add column if not exists bank_account_type text,
  add column if not exists pix_key text,
  add column if not exists bank_account_holder text,
  add column if not exists bank_holder_document text,
  add column if not exists bank_notes text,
  add column if not exists payment_instructions text;

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  document_number text,
  pix_key text,
  bank_details jsonb not null default '{}',
  monthly_amount numeric(14,2),
  role_title text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete cascade,
  amount numeric(14,2) not null,
  description text not null,
  recurrence text not null default 'monthly',
  status text not null default 'active' check (status in ('active', 'inactive')),
  next_due_date date not null default current_date,
  category text not null default 'Equipe / Mao de obra / Prestadores',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.expenses
  add column if not exists team_member_id uuid references public.team_members(id) on delete set null,
  add column if not exists recurring_expense_id uuid references public.recurring_expenses(id) on delete set null;

create index if not exists team_members_organization_id_idx
  on public.team_members(organization_id);
create index if not exists recurring_expenses_organization_id_idx
  on public.recurring_expenses(organization_id);
create unique index if not exists recurring_expenses_team_member_active_idx
  on public.recurring_expenses(team_member_id)
  where status = 'active' and team_member_id is not null;
create index if not exists expenses_team_member_id_idx
  on public.expenses(team_member_id);

drop trigger if exists set_team_members_updated_at on public.team_members;
create trigger set_team_members_updated_at
before update on public.team_members
for each row execute function public.set_updated_at();

drop trigger if exists set_recurring_expenses_updated_at on public.recurring_expenses;
create trigger set_recurring_expenses_updated_at
before update on public.recurring_expenses
for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;
alter table public.recurring_expenses enable row level security;

drop policy if exists "team_members_select_member" on public.team_members;
create policy "team_members_select_member"
  on public.team_members for select
  to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "team_members_crud_manager" on public.team_members;
create policy "team_members_crud_manager"
  on public.team_members for all
  to authenticated
  using (public.is_organization_manager(organization_id))
  with check (public.is_organization_manager(organization_id));

drop policy if exists "recurring_expenses_select_member" on public.recurring_expenses;
create policy "recurring_expenses_select_member"
  on public.recurring_expenses for select
  to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "recurring_expenses_crud_manager" on public.recurring_expenses;
create policy "recurring_expenses_crud_manager"
  on public.recurring_expenses for all
  to authenticated
  using (public.is_organization_manager(organization_id))
  with check (public.is_organization_manager(organization_id));

drop policy if exists "company_settings_crud_authenticated" on public.company_settings;
drop policy if exists "company_settings_select_member" on public.company_settings;
create policy "company_settings_select_member"
  on public.company_settings for select
  to authenticated
  using (organization_id is null or public.is_organization_member(organization_id));

drop policy if exists "company_settings_crud_manager" on public.company_settings;
create policy "company_settings_crud_manager"
  on public.company_settings for all
  to authenticated
  using (organization_id is null or public.is_organization_manager(organization_id))
  with check (organization_id is null or public.is_organization_manager(organization_id));

with boards(slug, name, description, position) as (
  values
    ('georreferenciamento', 'Georreferenciamento', 'Fluxo para certificacao, cartorio, INCRA e confrontantes.', 1),
    ('car', 'CAR', 'Cadastro Ambiental Rural e retificacoes.', 2),
    ('itr-ccir', 'ITR/CCIR', 'Declaracoes, regularizacoes e emissao de certificados.', 3),
    ('outros-servicos', 'Outros Servicos', 'Demandas tecnicas gerais do escritorio.', 4)
)
insert into public.service_boards (name, slug, description, position)
select name, slug, description, position from boards
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    position = excluded.position;

with desired(board_slug, name, slug, position) as (
  values
    ('georreferenciamento', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('georreferenciamento', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('georreferenciamento', 'Geo em Andamento', 'geo-em-andamento', 3),
    ('georreferenciamento', 'Prioridade', 'prioridade', 4),
    ('georreferenciamento', 'Geo Protocolado no Cartorio', 'geo-protocolado-cartorio', 5),
    ('georreferenciamento', 'Geo Protocolado no INCRA', 'geo-protocolado-incra', 6),
    ('georreferenciamento', 'Geo - Pendencia de Confrontante', 'geo-pendencia-confrontante', 7),
    ('georreferenciamento', 'Geo Concluido', 'geo-concluido', 8),
    ('car', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('car', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('car', 'CAR em Andamento', 'car-em-andamento', 3),
    ('car', 'Prioridade', 'prioridade', 4),
    ('car', 'CAR Protocolado/Em Analise', 'car-protocolado-em-analise', 5),
    ('car', 'CAR Concluido', 'car-concluido', 6),
    ('itr-ccir', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('itr-ccir', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('itr-ccir', 'ITR/CCIR em Andamento', 'itr-ccir-em-andamento', 3),
    ('itr-ccir', 'Prioridade', 'prioridade', 4),
    ('itr-ccir', 'Protocolado/Enviado', 'protocolado-enviado', 5),
    ('itr-ccir', 'Concluido', 'concluido', 6),
    ('outros-servicos', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('outros-servicos', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('outros-servicos', 'Em Andamento', 'em-andamento', 3),
    ('outros-servicos', 'Prioridade', 'prioridade', 4),
    ('outros-servicos', 'Concluido', 'concluido', 5)
)
insert into public.service_columns (board_id, name, slug, position)
select b.id, d.name, d.slug, d.position
from desired d
join public.service_boards b on b.slug = d.board_slug
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position;

notify pgrst, 'reload schema';
