create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null default 'default' unique,
  trade_name text,
  legal_name text,
  cnpj text,
  phone text,
  email text,
  website text,
  address text,
  city text,
  state text,
  logo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_services (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  name text not null,
  base_price numeric(14,2),
  billing_unit text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_services_active_idx on public.company_services(is_active);
create index if not exists company_services_niche_idx on public.company_services(niche);

drop trigger if exists set_company_settings_updated_at on public.company_settings;
create trigger set_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_company_services_updated_at on public.company_services;
create trigger set_company_services_updated_at
before update on public.company_services
for each row execute function public.set_updated_at();

alter table public.company_settings enable row level security;
alter table public.company_services enable row level security;

drop policy if exists "company_settings_crud_authenticated" on public.company_settings;
create policy "company_settings_crud_authenticated" on public.company_settings
for all to authenticated using (true) with check (true);

drop policy if exists "company_services_crud_authenticated" on public.company_services;
create policy "company_services_crud_authenticated" on public.company_services
for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
