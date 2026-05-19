-- FASE UX-ORG-SERVICES-1 - correcao RLS, coluna Servico perdido e financeiro de servicos.
-- Execute primeiro no Supabase de teste.

create or replace function public.is_org_member(
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
  );
$$;

create or replace function public.is_org_owner_or_admin(
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
      and om.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
  );
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_member(target_organization_id, auth.uid());
$$;

create or replace function public.is_organization_manager(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_owner_or_admin(target_organization_id, auth.uid());
$$;

grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.is_org_owner_or_admin(uuid, uuid) to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_manager(uuid) to authenticated;

drop policy if exists "organization_members_select_member" on public.organization_members;
drop policy if exists "organization_members_crud_owner_admin" on public.organization_members;
drop policy if exists "organization_members_select_safe" on public.organization_members;
drop policy if exists "organization_members_insert_owner_admin" on public.organization_members;
drop policy if exists "organization_members_update_owner_admin" on public.organization_members;
drop policy if exists "organization_members_delete_owner_admin" on public.organization_members;

create policy "organization_members_select_safe"
  on public.organization_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_owner_or_admin(organization_id, auth.uid())
  );

create policy "organization_members_insert_owner_admin"
  on public.organization_members for insert
  to authenticated
  with check (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "organization_members_update_owner_admin"
  on public.organization_members for update
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()))
  with check (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "organization_members_delete_owner_admin"
  on public.organization_members for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

drop policy if exists "organizations_update_member" on public.organizations;
drop policy if exists "organizations_update_manager" on public.organizations;
create policy "organizations_update_manager"
  on public.organizations for update
  to authenticated
  using (public.is_org_owner_or_admin(id, auth.uid()))
  with check (public.is_org_owner_or_admin(id, auth.uid()));

drop policy if exists "company_settings_crud_authenticated" on public.company_settings;
drop policy if exists "company_settings_select_member" on public.company_settings;
drop policy if exists "company_settings_crud_manager" on public.company_settings;
drop policy if exists "company_settings_insert_manager" on public.company_settings;
drop policy if exists "company_settings_update_manager" on public.company_settings;
drop policy if exists "company_settings_delete_manager" on public.company_settings;

create policy "company_settings_select_member"
  on public.company_settings for select
  to authenticated
  using (organization_id is null or public.is_org_member(organization_id, auth.uid()));

create policy "company_settings_insert_manager"
  on public.company_settings for insert
  to authenticated
  with check (organization_id is null or public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "company_settings_update_manager"
  on public.company_settings for update
  to authenticated
  using (organization_id is null or public.is_org_owner_or_admin(organization_id, auth.uid()))
  with check (organization_id is null or public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "company_settings_delete_manager"
  on public.company_settings for delete
  to authenticated
  using (organization_id is null or public.is_org_owner_or_admin(organization_id, auth.uid()));

drop policy if exists "team_members_select_member" on public.team_members;
drop policy if exists "team_members_crud_manager" on public.team_members;
drop policy if exists "team_members_insert_manager" on public.team_members;
drop policy if exists "team_members_update_manager" on public.team_members;
drop policy if exists "team_members_delete_manager" on public.team_members;

create policy "team_members_select_member"
  on public.team_members for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create policy "team_members_insert_manager"
  on public.team_members for insert
  to authenticated
  with check (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "team_members_update_manager"
  on public.team_members for update
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()))
  with check (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "team_members_delete_manager"
  on public.team_members for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

drop policy if exists "recurring_expenses_select_member" on public.recurring_expenses;
drop policy if exists "recurring_expenses_crud_manager" on public.recurring_expenses;
drop policy if exists "recurring_expenses_insert_manager" on public.recurring_expenses;
drop policy if exists "recurring_expenses_update_manager" on public.recurring_expenses;
drop policy if exists "recurring_expenses_delete_manager" on public.recurring_expenses;

create policy "recurring_expenses_select_member"
  on public.recurring_expenses for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create policy "recurring_expenses_insert_manager"
  on public.recurring_expenses for insert
  to authenticated
  with check (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "recurring_expenses_update_manager"
  on public.recurring_expenses for update
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()))
  with check (public.is_org_owner_or_admin(organization_id, auth.uid()));

create policy "recurring_expenses_delete_manager"
  on public.recurring_expenses for delete
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()));

drop policy if exists "service_members_select_member" on public.service_members;
drop policy if exists "service_members_crud_member" on public.service_members;
drop policy if exists "service_members_crud_manager" on public.service_members;

create policy "service_members_select_member"
  on public.service_members for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create policy "service_members_crud_manager"
  on public.service_members for all
  to authenticated
  using (public.is_org_owner_or_admin(organization_id, auth.uid()))
  with check (public.is_org_owner_or_admin(organization_id, auth.uid()));

with desired(board_slug, name, slug, position) as (
  values
    ('georreferenciamento', 'Servico perdido', 'servico-perdido', 9),
    ('car', 'Servico perdido', 'servico-perdido', 7),
    ('itr-ccir', 'Servico perdido', 'servico-perdido', 7),
    ('outros-servicos', 'Servico perdido', 'servico-perdido', 6)
)
insert into public.service_columns (board_id, name, slug, position)
select b.id, d.name, d.slug, d.position
from desired d
join public.service_boards b on b.slug = d.board_slug
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position;

create index if not exists revenues_service_card_auto_generated_idx
  on public.revenues(service_card_id)
  where service_card_id is not null
    and auto_generated = true;

notify pgrst, 'reload schema';
