-- GEOGESTAO-UI-PERFIS-ACESSIBILIDADE-SERVICOS-1
-- Perfil operacional por organização e campos seguros para edição do fluxo.

alter table if exists public.organizations
  add column if not exists operational_profile text not null default 'agrimensura';

update public.organizations
set operational_profile = 'agrimensura'
where operational_profile is null
   or operational_profile not in ('padrao', 'agrimensura', 'arquitetura');

alter table if exists public.organizations
  drop constraint if exists organizations_operational_profile_check;
alter table if exists public.organizations
  add constraint organizations_operational_profile_check
  check (operational_profile in ('padrao', 'agrimensura', 'arquitetura'));

alter table if exists public.service_boards
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists operational_profile text not null default 'agrimensura',
  add column if not exists is_active boolean not null default true;

alter table if exists public.service_columns
  add column if not exists is_active boolean not null default true,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.service_boards
set operational_profile = 'agrimensura'
where operational_profile is null;

alter table if exists public.service_boards
  drop constraint if exists service_boards_operational_profile_check;
alter table if exists public.service_boards
  add constraint service_boards_operational_profile_check
  check (operational_profile in ('padrao', 'agrimensura', 'arquitetura'));

create index if not exists service_boards_organization_profile_idx
  on public.service_boards(organization_id, operational_profile, is_active, position);
create index if not exists service_columns_active_position_idx
  on public.service_columns(board_id, is_active, position);
create index if not exists service_columns_organization_idx
  on public.service_columns(organization_id, board_id, is_active, position);

create table if not exists public.organization_service_board_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  board_id uuid not null references public.service_boards(id) on delete cascade,
  is_visible boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, board_id)
);

create table if not exists public.organization_service_column_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  column_id uuid not null references public.service_columns(id) on delete cascade,
  is_visible boolean not null default true,
  position integer not null default 0,
  custom_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, column_id)
);

create index if not exists organization_service_column_settings_order_idx
  on public.organization_service_column_settings(organization_id, is_visible, position);

create index if not exists organization_service_board_settings_order_idx
  on public.organization_service_board_settings(organization_id, is_visible, position);

alter table public.organization_service_board_settings enable row level security;
alter table public.organization_service_column_settings enable row level security;
drop policy if exists "organization_service_board_settings_member_select" on public.organization_service_board_settings;
drop policy if exists "organization_service_board_settings_owner_write" on public.organization_service_board_settings;
create policy "organization_service_board_settings_member_select"
  on public.organization_service_board_settings for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "organization_service_board_settings_owner_write"
  on public.organization_service_board_settings for all to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));
drop policy if exists "organization_service_column_settings_member_select" on public.organization_service_column_settings;
drop policy if exists "organization_service_column_settings_owner_write" on public.organization_service_column_settings;
create policy "organization_service_column_settings_member_select"
  on public.organization_service_column_settings for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "organization_service_column_settings_owner_write"
  on public.organization_service_column_settings for all to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

alter table public.service_boards enable row level security;
alter table public.service_columns enable row level security;

drop policy if exists "service_boards_crud_authenticated" on public.service_boards;
drop policy if exists "service_boards_select_scoped" on public.service_boards;
drop policy if exists "service_boards_owner_insert" on public.service_boards;
drop policy if exists "service_boards_owner_update" on public.service_boards;
drop policy if exists "service_boards_owner_delete" on public.service_boards;

create policy "service_boards_select_scoped"
  on public.service_boards for select to authenticated
  using (organization_id is null or public.is_organization_member(organization_id));

create policy "service_boards_owner_insert"
  on public.service_boards for insert to authenticated
  with check (organization_id is not null and public.is_organization_owner(organization_id));

create policy "service_boards_owner_update"
  on public.service_boards for update to authenticated
  using (organization_id is not null and public.is_organization_owner(organization_id))
  with check (organization_id is not null and public.is_organization_owner(organization_id));

create policy "service_boards_owner_delete"
  on public.service_boards for delete to authenticated
  using (organization_id is not null and public.is_organization_owner(organization_id));

-- Colunas dos quadros globais continuam legíveis; alterações são validadas no server action.
drop policy if exists "service_columns_crud_authenticated" on public.service_columns;
drop policy if exists "service_columns_select_authenticated" on public.service_columns;
drop policy if exists "service_columns_write_authenticated" on public.service_columns;

create policy "service_columns_select_authenticated"
  on public.service_columns for select to authenticated
  using (organization_id is null or public.is_organization_member(organization_id));
create policy "service_columns_write_authenticated"
  on public.service_columns for all to authenticated
  using (exists (select 1 from public.organization_members om where om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner'))
  with check (exists (select 1 from public.organization_members om where om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner'));

notify pgrst, 'reload schema';
