-- Ajuste de permissoes Minha Empresa.
-- Owner edita configuracoes da empresa; admin operacional apenas visualiza.
-- Execute primeiro no Supabase de teste.

create or replace function public.is_org_owner(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.status = 'active'
      and om.role = 'owner'
  );
$$;

create or replace function public.is_organization_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_owner(target_organization_id, auth.uid());
$$;

grant execute on function public.is_org_owner(uuid, uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;

-- Vinculo operacional da empresa Terras Reunidas.
-- Se algum e-mail ainda nao existir no Auth, a linha correspondente fica sem efeito.
with terras as (
  select id
  from public.organizations
  where slug = 'terras-reunidas'
  limit 1
),
desired_users as (
  select
    u.id as user_id,
    case
      when lower(u.email) = 'flavio.terras@gmail.com' then 'owner'
      when lower(u.email) in ('nataliasilva.terras@gmail.com', 'romeu@teste.com.br') then 'admin'
    end as role
  from auth.users u
  where lower(u.email) in (
    'flavio.terras@gmail.com',
    'nataliasilva.terras@gmail.com',
    'romeu@teste.com.br'
  )
)
update public.profiles p
set organization_id = terras.id
from terras, desired_users du
where p.id = du.user_id
  and terras.id is not null;

with terras as (
  select id
  from public.organizations
  where slug = 'terras-reunidas'
  limit 1
),
desired_users as (
  select
    u.id as user_id,
    case
      when lower(u.email) = 'flavio.terras@gmail.com' then 'owner'
      when lower(u.email) in ('nataliasilva.terras@gmail.com', 'romeu@teste.com.br') then 'admin'
    end as role
  from auth.users u
  where lower(u.email) in (
    'flavio.terras@gmail.com',
    'nataliasilva.terras@gmail.com',
    'romeu@teste.com.br'
  )
)
insert into public.organization_members (organization_id, user_id, role, status)
select terras.id, du.user_id, du.role, 'active'
from terras
join desired_users du on du.role is not null
where terras.id is not null
on conflict (organization_id, user_id) do update
set role = excluded.role,
    status = 'active';

drop policy if exists "organization_members_insert_owner_admin" on public.organization_members;
drop policy if exists "organization_members_update_owner_admin" on public.organization_members;
drop policy if exists "organization_members_delete_owner_admin" on public.organization_members;
drop policy if exists "organization_members_insert_owner" on public.organization_members;
drop policy if exists "organization_members_update_owner" on public.organization_members;
drop policy if exists "organization_members_delete_owner" on public.organization_members;

create policy "organization_members_insert_owner"
  on public.organization_members for insert
  to authenticated
  with check (public.is_org_owner(organization_id, auth.uid()));

create policy "organization_members_update_owner"
  on public.organization_members for update
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

create policy "organization_members_delete_owner"
  on public.organization_members for delete
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "organizations_update_manager" on public.organizations;
drop policy if exists "organizations_update_owner" on public.organizations;
create policy "organizations_update_owner"
  on public.organizations for update
  to authenticated
  using (public.is_org_owner(id, auth.uid()))
  with check (public.is_org_owner(id, auth.uid()));

drop policy if exists "company_settings_select_member" on public.company_settings;
drop policy if exists "company_settings_insert_manager" on public.company_settings;
drop policy if exists "company_settings_update_manager" on public.company_settings;
drop policy if exists "company_settings_delete_manager" on public.company_settings;
drop policy if exists "company_settings_select_owner_admin" on public.company_settings;
drop policy if exists "company_settings_insert_owner" on public.company_settings;
drop policy if exists "company_settings_update_owner" on public.company_settings;
drop policy if exists "company_settings_delete_owner" on public.company_settings;

create policy "company_settings_select_owner_admin"
  on public.company_settings for select
  to authenticated
  using (organization_id is null or public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "company_settings_insert_owner"
  on public.company_settings for insert
  to authenticated
  with check (organization_id is not null and public.is_org_owner(organization_id, auth.uid()));

create policy "company_settings_update_owner"
  on public.company_settings for update
  to authenticated
  using (organization_id is not null and public.is_org_owner(organization_id, auth.uid()))
  with check (organization_id is not null and public.is_org_owner(organization_id, auth.uid()));

create policy "company_settings_delete_owner"
  on public.company_settings for delete
  to authenticated
  using (organization_id is not null and public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "company_services_crud_authenticated" on public.company_services;
drop policy if exists "company_services_select_owner_admin" on public.company_services;
drop policy if exists "company_services_insert_owner" on public.company_services;
drop policy if exists "company_services_update_owner" on public.company_services;
drop policy if exists "company_services_delete_owner" on public.company_services;

alter table public.company_services enable row level security;

create policy "company_services_select_owner_admin"
  on public.company_services for select
  to authenticated
  using (organization_id is null or public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "company_services_insert_owner"
  on public.company_services for insert
  to authenticated
  with check (organization_id is not null and public.is_org_owner(organization_id, auth.uid()));

create policy "company_services_update_owner"
  on public.company_services for update
  to authenticated
  using (organization_id is not null and public.is_org_owner(organization_id, auth.uid()))
  with check (organization_id is not null and public.is_org_owner(organization_id, auth.uid()));

create policy "company_services_delete_owner"
  on public.company_services for delete
  to authenticated
  using (organization_id is not null and public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "team_members_select_member" on public.team_members;
drop policy if exists "team_members_insert_manager" on public.team_members;
drop policy if exists "team_members_update_manager" on public.team_members;
drop policy if exists "team_members_delete_manager" on public.team_members;
drop policy if exists "team_members_select_owner_admin" on public.team_members;
drop policy if exists "team_members_insert_owner" on public.team_members;
drop policy if exists "team_members_update_owner" on public.team_members;
drop policy if exists "team_members_delete_owner" on public.team_members;

create policy "team_members_select_owner_admin"
  on public.team_members for select
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "team_members_insert_owner"
  on public.team_members for insert
  to authenticated
  with check (public.is_org_owner(organization_id, auth.uid()));

create policy "team_members_update_owner"
  on public.team_members for update
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

create policy "team_members_delete_owner"
  on public.team_members for delete
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "recurring_expenses_select_member" on public.recurring_expenses;
drop policy if exists "recurring_expenses_insert_manager" on public.recurring_expenses;
drop policy if exists "recurring_expenses_update_manager" on public.recurring_expenses;
drop policy if exists "recurring_expenses_delete_manager" on public.recurring_expenses;
drop policy if exists "recurring_expenses_select_owner_admin" on public.recurring_expenses;
drop policy if exists "recurring_expenses_insert_owner" on public.recurring_expenses;
drop policy if exists "recurring_expenses_update_owner" on public.recurring_expenses;
drop policy if exists "recurring_expenses_delete_owner" on public.recurring_expenses;

create policy "recurring_expenses_select_owner_admin"
  on public.recurring_expenses for select
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "recurring_expenses_insert_owner"
  on public.recurring_expenses for insert
  to authenticated
  with check (public.is_org_owner(organization_id, auth.uid()));

create policy "recurring_expenses_update_owner"
  on public.recurring_expenses for update
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

create policy "recurring_expenses_delete_owner"
  on public.recurring_expenses for delete
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()));

notify pgrst, 'reload schema';
