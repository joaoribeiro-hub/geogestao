create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  service_card_id uuid references public.service_cards(id) on delete set null,
  name text not null,
  area numeric(14,4),
  registry_number text,
  registry_date date,
  car_state text,
  car_federal text,
  city text,
  state text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_geometries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  service_card_id uuid references public.service_cards(id) on delete set null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  geojson jsonb not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_client_id_idx on public.properties(client_id);
create index if not exists properties_service_card_id_idx on public.properties(service_card_id);
create index if not exists property_geometries_property_id_idx on public.property_geometries(property_id);
create index if not exists property_geometries_client_id_idx on public.property_geometries(client_id);
create index if not exists property_geometries_service_card_id_idx on public.property_geometries(service_card_id);

drop trigger if exists set_properties_updated_at on public.properties;
create trigger set_properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

drop trigger if exists set_property_geometries_updated_at on public.property_geometries;
create trigger set_property_geometries_updated_at
before update on public.property_geometries
for each row execute function public.set_updated_at();

alter table public.properties enable row level security;
alter table public.property_geometries enable row level security;

drop policy if exists "properties_crud_authenticated" on public.properties;
create policy "properties_crud_authenticated" on public.properties
for all to authenticated using (true) with check (true);

drop policy if exists "property_geometries_crud_authenticated" on public.property_geometries;
create policy "property_geometries_crud_authenticated" on public.property_geometries
for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
