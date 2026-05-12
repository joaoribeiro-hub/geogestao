-- Fase GEOQUERY-1: busca de imovel por CAR Federal com CAR, INCRA/SIGEF, alertas e tematicas.
-- Migration aditiva e segura. Nao consulta Google Drive em tempo real e nao automatiza gov.br.

do $$
begin
  begin
    create extension if not exists postgis with schema extensions;
  exception
    when insufficient_privilege or undefined_file then
      raise notice 'PostGIS nao foi habilitado. GeoQuery usara geom_geojson como fallback ate PostGIS estar disponivel.';
  end;
end $$;

create table if not exists public.geo_data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  source_type text not null check (source_type in ('car', 'incra', 'alerta', 'tematica')),
  name text not null,
  provider text,
  reference_year text,
  reference_date date,
  drive_folder_id text,
  drive_file_id text,
  original_file_name text,
  original_file_path text,
  storage_path text,
  imported_at timestamptz,
  imported_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'imported', 'failed')),
  error_message text,
  record_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.car_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  cod_car text not null,
  uf text,
  municipio text,
  area_ha numeric,
  status_car text,
  data_inscricao date,
  data_atualizacao date,
  attributes jsonb not null default '{}'::jsonb,
  geom_geojson jsonb,
  bbox jsonb,
  source_id uuid references public.geo_data_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incra_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  sigef_code text,
  cnir text,
  codigo_imovel text,
  certificacao text,
  situacao text,
  municipio text,
  uf text,
  area_ha numeric,
  data_certificacao date,
  attributes jsonb not null default '{}'::jsonb,
  geom_geojson jsonb,
  bbox jsonb,
  source_id uuid references public.geo_data_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.geo_alert_layers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  layer_type text not null,
  provider text,
  reference_year text,
  name text not null,
  alert_date date,
  area_ha numeric,
  attributes jsonb not null default '{}'::jsonb,
  geom_geojson jsonb,
  bbox jsonb,
  source_id uuid references public.geo_data_sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.geo_thematic_layers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  layer_type text not null,
  provider text,
  reference_year text,
  name text not null,
  attributes jsonb not null default '{}'::jsonb,
  geom_geojson jsonb,
  bbox jsonb,
  source_id uuid references public.geo_data_sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.property_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  cod_car text not null,
  client_id uuid references public.clients(id) on delete set null,
  service_card_id uuid references public.service_cards(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'partial' check (status in ('found', 'not_found', 'partial', 'failed')),
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.property_search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.property_searches(id) on delete cascade,
  result_type text not null check (result_type in ('car', 'incra', 'alerta', 'tematica', 'documento', 'download')),
  title text not null,
  description text,
  data jsonb not null default '{}'::jsonb,
  geometry_geojson jsonb,
  storage_path text,
  external_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  cod_car text,
  client_id uuid references public.clients(id) on delete set null,
  service_card_id uuid references public.service_cards(id) on delete set null,
  document_type text not null,
  title text not null,
  storage_path text,
  external_url text,
  source text,
  status text not null default 'available' check (status in ('available', 'pending', 'failed', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists geo_data_sources_source_type_idx on public.geo_data_sources(source_type);
create index if not exists geo_data_sources_status_idx on public.geo_data_sources(status);
create index if not exists geo_data_sources_organization_id_idx on public.geo_data_sources(organization_id);
create unique index if not exists car_properties_cod_car_global_idx
  on public.car_properties(cod_car)
  where organization_id is null;
create unique index if not exists car_properties_org_cod_car_idx
  on public.car_properties(organization_id, cod_car)
  where organization_id is not null;
create index if not exists car_properties_cod_car_idx on public.car_properties(cod_car);
create index if not exists car_properties_uf_municipio_idx on public.car_properties(uf, municipio);
create index if not exists incra_properties_sigef_code_idx on public.incra_properties(sigef_code);
create index if not exists incra_properties_cnir_idx on public.incra_properties(cnir);
create index if not exists incra_properties_codigo_imovel_idx on public.incra_properties(codigo_imovel);
create index if not exists incra_properties_uf_municipio_idx on public.incra_properties(uf, municipio);
create index if not exists geo_alert_layers_layer_type_idx on public.geo_alert_layers(layer_type);
create index if not exists geo_alert_layers_provider_idx on public.geo_alert_layers(provider);
create index if not exists geo_alert_layers_alert_date_idx on public.geo_alert_layers(alert_date);
create index if not exists geo_thematic_layers_layer_type_idx on public.geo_thematic_layers(layer_type);
create index if not exists geo_thematic_layers_provider_idx on public.geo_thematic_layers(provider);
create index if not exists property_searches_cod_car_idx on public.property_searches(cod_car);
create index if not exists property_searches_organization_created_idx on public.property_searches(organization_id, created_at desc);
create index if not exists property_search_results_search_id_idx on public.property_search_results(search_id);
create index if not exists property_documents_cod_car_idx on public.property_documents(cod_car);
create index if not exists property_documents_organization_id_idx on public.property_documents(organization_id);

do $$
declare
  geometry_type text;
begin
  select quote_ident(n.nspname) || '.geometry'
  into geometry_type
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where t.typname = 'geometry'
  order by case when n.nspname = 'extensions' then 0 else 1 end
  limit 1;

  if geometry_type is not null then
    execute format('alter table public.car_properties add column if not exists geom %s(MultiPolygon, 4674)', geometry_type);
    execute format('alter table public.incra_properties add column if not exists geom %s(MultiPolygon, 4674)', geometry_type);
    execute format('alter table public.geo_alert_layers add column if not exists geom %s(MultiPolygon, 4674)', geometry_type);
    execute format('alter table public.geo_thematic_layers add column if not exists geom %s(MultiPolygon, 4674)', geometry_type);

    execute 'create index if not exists car_properties_geom_idx on public.car_properties using gist (geom)';
    execute 'create index if not exists incra_properties_geom_idx on public.incra_properties using gist (geom)';
    execute 'create index if not exists geo_alert_layers_geom_idx on public.geo_alert_layers using gist (geom)';
    execute 'create index if not exists geo_thematic_layers_geom_idx on public.geo_thematic_layers using gist (geom)';
  end if;
end $$;

drop trigger if exists set_car_properties_updated_at on public.car_properties;
create trigger set_car_properties_updated_at
before update on public.car_properties
for each row execute function public.set_updated_at();

drop trigger if exists set_incra_properties_updated_at on public.incra_properties;
create trigger set_incra_properties_updated_at
before update on public.incra_properties
for each row execute function public.set_updated_at();

alter table public.geo_data_sources enable row level security;
alter table public.car_properties enable row level security;
alter table public.incra_properties enable row level security;
alter table public.geo_alert_layers enable row level security;
alter table public.geo_thematic_layers enable row level security;
alter table public.property_searches enable row level security;
alter table public.property_search_results enable row level security;
alter table public.property_documents enable row level security;

create or replace function public.geoquery_can_access(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_organization_id is null
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = target_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    );
$$;

drop policy if exists "geo_data_sources_access_member_or_global" on public.geo_data_sources;
create policy "geo_data_sources_access_member_or_global"
  on public.geo_data_sources for all
  to authenticated
  using (public.geoquery_can_access(organization_id))
  with check (public.geoquery_can_access(organization_id));

drop policy if exists "car_properties_access_member_or_global" on public.car_properties;
create policy "car_properties_access_member_or_global"
  on public.car_properties for all
  to authenticated
  using (public.geoquery_can_access(organization_id))
  with check (public.geoquery_can_access(organization_id));

drop policy if exists "incra_properties_access_member_or_global" on public.incra_properties;
create policy "incra_properties_access_member_or_global"
  on public.incra_properties for all
  to authenticated
  using (public.geoquery_can_access(organization_id))
  with check (public.geoquery_can_access(organization_id));

drop policy if exists "geo_alert_layers_access_member_or_global" on public.geo_alert_layers;
create policy "geo_alert_layers_access_member_or_global"
  on public.geo_alert_layers for all
  to authenticated
  using (public.geoquery_can_access(organization_id))
  with check (public.geoquery_can_access(organization_id));

drop policy if exists "geo_thematic_layers_access_member_or_global" on public.geo_thematic_layers;
create policy "geo_thematic_layers_access_member_or_global"
  on public.geo_thematic_layers for all
  to authenticated
  using (public.geoquery_can_access(organization_id))
  with check (public.geoquery_can_access(organization_id));

drop policy if exists "property_searches_access_member" on public.property_searches;
create policy "property_searches_access_member"
  on public.property_searches for all
  to authenticated
  using (public.geoquery_can_access(organization_id))
  with check (public.geoquery_can_access(organization_id));

drop policy if exists "property_search_results_access_by_search" on public.property_search_results;
create policy "property_search_results_access_by_search"
  on public.property_search_results for all
  to authenticated
  using (
    exists (
      select 1
      from public.property_searches ps
      where ps.id = property_search_results.search_id
        and public.geoquery_can_access(ps.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.property_searches ps
      where ps.id = property_search_results.search_id
        and public.geoquery_can_access(ps.organization_id)
    )
  );

drop policy if exists "property_documents_access_member_or_global" on public.property_documents;
create policy "property_documents_access_member_or_global"
  on public.property_documents for all
  to authenticated
  using (public.geoquery_can_access(organization_id))
  with check (public.geoquery_can_access(organization_id));

notify pgrst, 'reload schema';
