-- FASE AUTH-ORG-PLANS-1
-- Cadastro publico, recuperacao de senha, onboarding de empresa e base de planos.
-- Execute primeiro no Supabase de teste.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists email text,
  add column if not exists cpf text,
  add column if not exists onboarding_status text not null default 'pending_organization';

alter table public.profiles drop constraint if exists profiles_onboarding_status_check;
alter table public.profiles
  add constraint profiles_onboarding_status_check
  check (onboarding_status in ('pending_organization', 'complete'));

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

update public.profiles
set onboarding_status = case
  when organization_id is null then 'pending_organization'
  else 'complete'
end
where onboarding_status is null
   or (organization_id is null and onboarding_status <> 'pending_organization')
   or (organization_id is not null and onboarding_status <> 'complete');

alter table public.plans
  add column if not exists description text,
  add column if not exists price_monthly_cents integer not null default 0,
  add column if not exists storage_limit_mb integer,
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists is_public boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.plans
set storage_limit_mb = coalesce(storage_limit_mb, storage_quota_mb);

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

insert into public.plans (
  name,
  slug,
  description,
  price_monthly,
  price_monthly_cents,
  max_users,
  storage_quota_mb,
  storage_limit_mb,
  max_proposals_per_month,
  max_contracts_per_month,
  max_finance_records_per_month,
  ai_enabled,
  features,
  is_active,
  is_public
)
values (
  'Iniciante',
  'iniciante',
  'Plano inicial sem cobranca nesta fase, com 1 owner e ate 2 admins operacionais.',
  0,
  0,
  3,
  3072,
  3072,
  null,
  null,
  null,
  true,
  '{"assistant": true, "max_admins": 2, "billing": false}'::jsonb,
  true,
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  price_monthly_cents = excluded.price_monthly_cents,
  max_users = excluded.max_users,
  storage_quota_mb = excluded.storage_quota_mb,
  storage_limit_mb = excluded.storage_limit_mb,
  ai_enabled = excluded.ai_enabled,
  features = excluded.features,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  updated_at = now();

create table if not exists public.organization_join_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'quarterly', 'yearly')),
  provider text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  amount_cents integer not null default 0,
  billing_period_months integer not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'paid', 'canceled', 'expired')),
  provider text,
  provider_checkout_url text,
  provider_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_organization_join_codes_updated_at on public.organization_join_codes;
create trigger set_organization_join_codes_updated_at
before update on public.organization_join_codes
for each row execute function public.set_updated_at();

drop trigger if exists set_organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger set_organization_subscriptions_updated_at
before update on public.organization_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_billing_orders_updated_at on public.billing_orders;
create trigger set_billing_orders_updated_at
before update on public.billing_orders
for each row execute function public.set_updated_at();

create or replace function public.is_org_owner(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
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
      and om.role = 'owner'
      and om.status = 'active'
  );
$$;

create or replace function public.is_org_admin_or_owner(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
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
      and om.role in ('owner', 'admin')
      and om.status = 'active'
  );
$$;

create or replace function public.generate_organization_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (
      select 1 from public.organization_join_codes where code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.make_organization_slug(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base_slug text;
begin
  base_slug := regexp_replace(lower(coalesce(p_name, 'empresa')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then
    base_slug := 'empresa';
  end if;
  return base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
end;
$$;

create or replace function public.can_request_password_reset(
  p_email text,
  p_birth_date date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where lower(p.email) = lower(trim(p_email))
      and p.birth_date = p_birth_date
  );
$$;

create or replace function public.get_organization_usage(p_organization_id uuid)
returns table (
  users_count integer,
  storage_used_mb numeric,
  services_count integer,
  documents_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      select count(*)::integer
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.status = 'active'
    ) as users_count,
    (
      select round(coalesce(sum(coalesce(a.file_size, a.size_bytes, 0)), 0)::numeric / 1024 / 1024, 2)
      from public.attachments a
      where a.organization_id = p_organization_id
        and coalesce(a.is_global, false) = false
    ) as storage_used_mb,
    (
      select count(*)::integer
      from public.service_cards sc
      where sc.organization_id = p_organization_id
    ) as services_count,
    (
      select count(*)::integer
      from public.document_templates dt
      where dt.organization_id = p_organization_id
        and coalesce(dt.is_global, false) = false
    ) as documents_count;
$$;

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_document_number text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_city text default null,
  p_state text default null,
  p_notes text default null
)
returns table (
  organization_id uuid,
  join_code text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_org_id uuid;
  v_code text;
  v_storage_limit integer;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.user_id = v_user_id
      and om.status = 'active'
  ) then
    raise exception 'Este usuario ja participa de uma empresa.';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Informe o nome da empresa.';
  end if;

  select id, coalesce(storage_limit_mb, storage_quota_mb, 3072)
  into v_plan_id, v_storage_limit
  from public.plans
  where slug = 'iniciante'
  limit 1;

  if v_plan_id is null then
    raise exception 'Plano Iniciante nao encontrado.';
  end if;

  v_code := public.generate_organization_join_code();

  insert into public.organizations (
    name,
    trade_name,
    slug,
    document_number,
    owner_user_id,
    plan_id,
    storage_quota_mb,
    status
  )
  values (
    trim(p_name),
    trim(p_name),
    public.make_organization_slug(p_name),
    nullif(trim(coalesce(p_document_number, '')), ''),
    v_user_id,
    v_plan_id,
    v_storage_limit,
    'active'
  )
  returning id into v_org_id;

  insert into public.organization_join_codes (organization_id, code, status, created_by)
  values (v_org_id, v_code, 'active', v_user_id);

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  update public.profiles
  set
    organization_id = v_org_id,
    onboarding_status = 'complete',
    updated_at = now()
  where id = v_user_id;

  insert into public.company_settings (
    organization_id,
    singleton_key,
    trade_name,
    legal_name,
    cnpj,
    phone,
    email,
    address,
    city,
    state,
    notes
  )
  values (
    v_org_id,
    'default',
    trim(p_name),
    trim(p_name),
    nullif(trim(coalesce(p_document_number, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  on conflict (organization_id, singleton_key) do nothing;

  insert into public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_start,
    billing_interval,
    provider
  )
  values (v_org_id, v_plan_id, 'active', now(), 'monthly', 'manual');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'organization.created',
    'organization',
    v_org_id,
    jsonb_build_object('source', 'onboarding', 'plan', 'iniciante')
  );

  organization_id := v_org_id;
  join_code := v_code;
  return next;
end;
$$;

create or replace function public.join_organization_by_code(p_join_code text)
returns table (
  organization_id uuid,
  role text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_plan public.plans%rowtype;
  v_active_users integer;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.user_id = v_user_id
      and om.status = 'active'
  ) then
    raise exception 'Este usuario ja participa de uma empresa.';
  end if;

  select ojc.organization_id
  into v_org_id
  from public.organization_join_codes ojc
  join public.organizations o on o.id = ojc.organization_id
  where upper(trim(ojc.code)) = upper(trim(p_join_code))
    and ojc.status = 'active'
    and o.status in ('active', 'trialing')
  limit 1;

  if v_org_id is null then
    raise exception 'Codigo da empresa invalido.';
  end if;

  select p.*
  into v_plan
  from public.organizations o
  join public.plans p on p.id = o.plan_id
  where o.id = v_org_id;

  select count(*)::integer
  into v_active_users
  from public.organization_members
  where organization_id = v_org_id
    and status = 'active';

  if v_plan.max_users is not null and v_active_users >= v_plan.max_users then
    raise exception 'Esta empresa atingiu o limite de usuarios do plano atual.';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'admin', 'active')
  on conflict (organization_id, user_id) do update
  set role = 'admin', status = 'active';

  update public.profiles
  set
    organization_id = v_org_id,
    onboarding_status = 'complete',
    updated_at = now()
  where id = v_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'organization.joined_by_code',
    'organization',
    v_org_id,
    jsonb_build_object('role', 'admin')
  );

  organization_id := v_org_id;
  role := 'admin';
  return next;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth_date date;
begin
  if coalesce(new.raw_user_meta_data ->> 'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_birth_date := (new.raw_user_meta_data ->> 'birth_date')::date;
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    cpf,
    birth_date,
    document_type,
    document_number,
    role,
    organization_id,
    onboarding_status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'cpf', ''),
    v_birth_date,
    case when nullif(new.raw_user_meta_data ->> 'cpf', '') is not null then 'cpf' else null end,
    nullif(new.raw_user_meta_data ->> 'cpf', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'leitura'),
    null,
    'pending_organization'
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    cpf = coalesce(public.profiles.cpf, excluded.cpf),
    birth_date = coalesce(public.profiles.birth_date, excluded.birth_date),
    document_type = coalesce(public.profiles.document_type, excluded.document_type),
    document_number = coalesce(public.profiles.document_number, excluded.document_number),
    onboarding_status = case
      when public.profiles.organization_id is null then 'pending_organization'
      else 'complete'
    end,
    updated_at = now();

  return new;
end;
$$;

alter table public.organization_join_codes enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.billing_orders enable row level security;

drop policy if exists "plans_select_authenticated" on public.plans;
create policy "plans_select_authenticated"
  on public.plans for select
  to authenticated
  using (is_active = true and is_public = true);

drop policy if exists "organizations_update_member" on public.organizations;
drop policy if exists "organizations_update_manager" on public.organizations;
drop policy if exists "organizations_update_owner" on public.organizations;
create policy "organizations_update_owner"
  on public.organizations for update
  to authenticated
  using (public.is_org_owner(id, auth.uid()))
  with check (public.is_org_owner(id, auth.uid()));

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_current_or_org" on public.profiles;
create policy "profiles_select_current_or_org"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or (
      organization_id is not null
      and public.is_org_admin_or_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "organization_join_codes_select_owner" on public.organization_join_codes;
create policy "organization_join_codes_select_owner"
  on public.organization_join_codes for select
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "organization_join_codes_update_owner" on public.organization_join_codes;
create policy "organization_join_codes_update_owner"
  on public.organization_join_codes for update
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "organization_subscriptions_select_org_admin" on public.organization_subscriptions;
create policy "organization_subscriptions_select_org_admin"
  on public.organization_subscriptions for select
  to authenticated
  using (public.is_org_admin_or_owner(organization_id, auth.uid()));

drop policy if exists "organization_subscriptions_update_owner" on public.organization_subscriptions;
create policy "organization_subscriptions_update_owner"
  on public.organization_subscriptions for update
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "billing_orders_select_owner" on public.billing_orders;
create policy "billing_orders_select_owner"
  on public.billing_orders for select
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()));

create index if not exists profiles_email_idx on public.profiles(lower(email));
create index if not exists profiles_onboarding_status_idx on public.profiles(onboarding_status);
create index if not exists organization_join_codes_code_idx on public.organization_join_codes(code);
create unique index if not exists organization_join_codes_one_active_per_org_idx
  on public.organization_join_codes(organization_id)
  where status = 'active';
create index if not exists organization_subscriptions_org_idx on public.organization_subscriptions(organization_id, status);
create index if not exists billing_orders_org_idx on public.billing_orders(organization_id, status);

revoke all on function public.can_request_password_reset(text, date) from public;
grant execute on function public.can_request_password_reset(text, date) to anon, authenticated;

revoke all on function public.create_organization_for_current_user(text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_organization_for_current_user(text, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.join_organization_by_code(text) from public;
grant execute on function public.join_organization_by_code(text) to authenticated;

revoke all on function public.get_organization_usage(uuid) from public;
grant execute on function public.get_organization_usage(uuid) to authenticated;

notify pgrst, 'reload schema';
