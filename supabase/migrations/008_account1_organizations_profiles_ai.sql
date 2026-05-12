-- Fase ACCOUNT-1: Minha Conta, base multiempresa, planos, limites e IA.
-- Migration aditiva e segura: nao edita migrations antigas e evita RLS restritiva nas tabelas existentes.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  price_monthly numeric(14,2) not null default 0,
  max_users integer not null default 1,
  storage_quota_mb integer not null default 1024,
  max_proposals_per_month integer,
  max_contracts_per_month integer,
  max_finance_records_per_month integer,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.plans (
  name,
  slug,
  price_monthly,
  max_users,
  storage_quota_mb,
  max_proposals_per_month,
  max_contracts_per_month,
  max_finance_records_per_month,
  features,
  is_active
)
values
  (
    'Gratuito',
    'gratuito',
    0,
    1,
    1024,
    10,
    10,
    15,
    '{"advanced_reports": false, "ai_chat": false}'::jsonb,
    true
  ),
  (
    'Premium basico',
    'premium_basico',
    0,
    3,
    3072,
    100000,
    100000,
    100000,
    '{"advanced_reports": true, "ai_chat": true}'::jsonb,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  max_users = excluded.max_users,
  storage_quota_mb = excluded.storage_quota_mb,
  max_proposals_per_month = excluded.max_proposals_per_month,
  max_contracts_per_month = excluded.max_contracts_per_month,
  max_finance_records_per_month = excluded.max_finance_records_per_month,
  features = excluded.features,
  is_active = excluded.is_active;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade_name text,
  document_number text,
  owner_user_id uuid references auth.users(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  storage_quota_mb integer not null default 1024,
  storage_used_bytes bigint not null default 0,
  status text not null default 'active'
    check (status in ('active', 'trialing', 'suspended', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'leitura'
    check (role in ('owner', 'admin', 'gerente', 'tecnico', 'financeiro', 'leitura')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists birth_date date,
  add column if not exists document_type text,
  add column if not exists document_number text,
  add column if not exists avatar_path text,
  add column if not exists email_preferences jsonb not null default '{"summaries": true, "special_dates": false, "projects": true, "proposals": true, "finance": true}'::jsonb,
  add column if not exists account_preferences jsonb not null default '{}'::jsonb;

do $$
declare
  free_plan_id uuid;
  profile_row record;
  new_org_id uuid;
begin
  select id into free_plan_id from public.plans where slug = 'gratuito';

  for profile_row in
    select p.id, p.full_name, p.organization_id
    from public.profiles p
    where p.organization_id is null
  loop
    insert into public.organizations (
      name,
      trade_name,
      owner_user_id,
      plan_id,
      storage_quota_mb,
      status
    )
    values (
      coalesce(profile_row.full_name, 'Minha Organizacao'),
      coalesce(profile_row.full_name, 'Minha Organizacao'),
      profile_row.id,
      free_plan_id,
      1024,
      'active'
    )
    returning id into new_org_id;

    update public.profiles
    set organization_id = new_org_id
    where id = profile_row.id;

    insert into public.organization_members (organization_id, user_id, role, status)
    values (new_org_id, profile_row.id, 'owner', 'active')
    on conflict (organization_id, user_id) do nothing;
  end loop;
end $$;

alter table if exists public.clients add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.client_interactions add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.proposals add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.contracts add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.service_cards add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.revenues add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.expenses add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.document_templates add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.legislation_items add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.company_settings add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.company_services add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.properties add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table if exists public.property_geometries add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.attachments
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists bucket text not null default 'attachments',
  add column if not exists storage_path text,
  add column if not exists file_size bigint,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.attachments drop constraint if exists attachments_entity_type_check;
alter table public.attachments
  add constraint attachments_entity_type_check
  check (
    entity_type in (
      'profile',
      'client',
      'proposal',
      'service_card',
      'contract',
      'revenue',
      'expense',
      'document_template',
      'legislation_item'
    )
  );

do $$
declare
  fallback_org_id uuid;
begin
  select id into fallback_org_id from public.organizations order by created_at limit 1;

  update public.clients c
  set organization_id = p.organization_id
  from public.profiles p
  where c.organization_id is null and c.created_by = p.id;
  update public.clients set organization_id = fallback_org_id where organization_id is null;

  update public.client_interactions ci
  set organization_id = c.organization_id
  from public.clients c
  where ci.organization_id is null and ci.client_id = c.id;
  update public.client_interactions set organization_id = fallback_org_id where organization_id is null;

  update public.proposals p
  set organization_id = pr.organization_id
  from public.profiles pr
  where p.organization_id is null and p.owner_id = pr.id;
  update public.proposals set organization_id = fallback_org_id where organization_id is null;

  update public.service_cards sc
  set organization_id = pr.organization_id
  from public.profiles pr
  where sc.organization_id is null and sc.owner_id = pr.id;
  update public.service_cards set organization_id = fallback_org_id where organization_id is null;

  update public.contracts c
  set organization_id = pr.organization_id
  from public.profiles pr
  where c.organization_id is null and c.created_by = pr.id;
  update public.contracts set organization_id = fallback_org_id where organization_id is null;

  update public.revenues r
  set organization_id = c.organization_id
  from public.clients c
  where r.organization_id is null and r.client_id = c.id;
  update public.revenues set organization_id = fallback_org_id where organization_id is null;

  update public.expenses e
  set organization_id = c.organization_id
  from public.clients c
  where e.organization_id is null and e.client_id = c.id;
  update public.expenses set organization_id = fallback_org_id where organization_id is null;

  update public.company_settings set organization_id = fallback_org_id where organization_id is null;
  update public.company_services set organization_id = fallback_org_id where organization_id is null;
  update public.document_templates set organization_id = fallback_org_id where organization_id is null;
  update public.legislation_items set organization_id = fallback_org_id where organization_id is null;
  update public.properties set organization_id = fallback_org_id where organization_id is null;
  update public.property_geometries set organization_id = fallback_org_id where organization_id is null;

  update public.attachments a
  set
    organization_id = coalesce(p.organization_id, fallback_org_id),
    bucket = coalesce(a.bucket, 'attachments'),
    storage_path = coalesce(a.storage_path, a.file_path),
    file_size = coalesce(a.file_size, a.size_bytes),
    created_by = coalesce(a.created_by, a.uploaded_by)
  from public.profiles p
  where a.uploaded_by = p.id;
  update public.attachments
  set
    organization_id = coalesce(organization_id, fallback_org_id),
    bucket = coalesce(bucket, 'attachments'),
    storage_path = coalesce(storage_path, file_path),
    file_size = coalesce(file_size, size_bytes),
    created_by = coalesce(created_by, uploaded_by)
  where organization_id is null or storage_path is null or file_size is null;
end $$;

alter table if exists public.company_settings
  drop constraint if exists company_settings_singleton_key_key;
create unique index if not exists company_settings_organization_singleton_key_idx
  on public.company_settings(organization_id, singleton_key);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.plans enable row level security;

create or replace function public.is_organization_member(target_organization_id uuid)
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
  );
$$;

drop policy if exists "plans_select_authenticated" on public.plans;
create policy "plans_select_authenticated"
  on public.plans for select
  to authenticated
  using (is_active = true);

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (public.is_organization_member(id));

drop policy if exists "organizations_update_member" on public.organizations;
create policy "organizations_update_member"
  on public.organizations for update
  to authenticated
  using (public.is_organization_member(id))
  with check (public.is_organization_member(id));

drop policy if exists "organization_members_select_member" on public.organization_members;
create policy "organization_members_select_member"
  on public.organization_members for select
  to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "organization_members_crud_owner_admin" on public.organization_members;
create policy "organization_members_crud_owner_admin"
  on public.organization_members for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members current_member
      where current_member.organization_id = organization_members.organization_id
        and current_member.user_id = auth.uid()
        and current_member.status = 'active'
        and current_member.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members current_member
      where current_member.organization_id = organization_members.organization_id
        and current_member.user_id = auth.uid()
        and current_member.status = 'active'
        and current_member.role in ('owner', 'admin')
    )
  );

create index if not exists profiles_organization_id_idx on public.profiles(organization_id);
create index if not exists organizations_plan_id_idx on public.organizations(plan_id);
create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists organization_members_organization_id_idx on public.organization_members(organization_id);
create index if not exists clients_organization_id_idx on public.clients(organization_id);
create index if not exists proposals_organization_id_idx on public.proposals(organization_id);
create index if not exists contracts_organization_id_idx on public.contracts(organization_id);
create index if not exists service_cards_organization_id_idx on public.service_cards(organization_id);
create index if not exists revenues_organization_id_idx on public.revenues(organization_id);
create index if not exists expenses_organization_id_idx on public.expenses(organization_id);
create index if not exists attachments_organization_id_idx on public.attachments(organization_id);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_plan_id uuid;
  new_org_id uuid;
begin
  select id into free_plan_id from public.plans where slug = 'gratuito';

  insert into public.organizations (
    name,
    trade_name,
    owner_user_id,
    plan_id,
    storage_quota_mb,
    status
  )
  values (
    coalesce(new.raw_user_meta_data ->> 'organization_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Minha Organizacao'),
    coalesce(new.raw_user_meta_data ->> 'organization_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Minha Organizacao'),
    new.id,
    free_plan_id,
    1024,
    'active'
  )
  returning id into new_org_id;

  insert into public.profiles (id, full_name, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'admin'),
    new_org_id
  )
  on conflict (id) do update
  set organization_id = coalesce(public.profiles.organization_id, excluded.organization_id);

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_org_id, new.id, 'owner', 'active')
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
