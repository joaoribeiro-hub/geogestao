-- Fase GEOQUERY-3: cruzamento espacial CAR x SIGEF e suporte a alertas MapBiomas.
-- Migration aditiva e segura. Nao consulta Drive em tempo real e nao automatiza portais externos.

create extension if not exists postgis with schema extensions;

set search_path = public, extensions;

alter table public.car_properties
  add column if not exists geom geometry(MultiPolygon, 4674);

alter table public.incra_properties
  add column if not exists geom geometry(MultiPolygon, 4674);

alter table public.geo_alert_layers
  add column if not exists geom geometry(MultiPolygon, 4674),
  add column if not exists cod_car text,
  add column if not exists cod_imovel text,
  add column if not exists alert_code integer,
  add column if not exists codigo_alerta text,
  add column if not exists area_intersecao_ha numeric,
  add column if not exists area_alerta_ha numeric;

alter table public.geo_thematic_layers
  add column if not exists geom geometry(MultiPolygon, 4674);

create index if not exists car_properties_geom_idx on public.car_properties using gist (geom);
create index if not exists incra_properties_geom_idx on public.incra_properties using gist (geom);
create index if not exists geo_alert_layers_geom_idx on public.geo_alert_layers using gist (geom);
create index if not exists geo_thematic_layers_geom_idx on public.geo_thematic_layers using gist (geom);
create index if not exists geo_alert_layers_cod_car_idx on public.geo_alert_layers(cod_car);
create index if not exists geo_alert_layers_cod_imovel_idx on public.geo_alert_layers(cod_imovel);
create index if not exists geo_alert_layers_alert_code_idx on public.geo_alert_layers(alert_code);

update public.geo_alert_layers
set
  cod_car = coalesce(
    cod_car,
    nullif(attributes->>'cod_car', ''),
    nullif(attributes->>'car_code', ''),
    nullif(attributes->>'codigo_car', ''),
    nullif(attributes->>'car', ''),
    nullif(attributes->>'cod_car_federal', '')
  ),
  cod_imovel = coalesce(
    cod_imovel,
    nullif(attributes->>'cod_imovel', ''),
    nullif(attributes->>'codigo_imovel', ''),
    nullif(attributes->>'property_code', ''),
    nullif(attributes->>'imovel', '')
  ),
  codigo_alerta = coalesce(
    codigo_alerta,
    nullif(attributes->>'codigo_alerta', ''),
    nullif(attributes->>'cod_alerta', ''),
    nullif(attributes->>'alert_code', ''),
    nullif(attributes->>'alerta', '')
  ),
  alert_code = coalesce(
    alert_code,
    nullif(regexp_replace(coalesce(
      attributes->>'alert_code',
      attributes->>'codigo_alerta',
      attributes->>'cod_alerta',
      attributes->>'alerta',
      attributes->>'id_alerta',
      ''
    ), '[^0-9]', '', 'g'), '')::integer
  ),
  area_intersecao_ha = coalesce(
    area_intersecao_ha,
    nullif(replace(regexp_replace(coalesce(
      attributes->>'area_intersecao_ha',
      attributes->>'area_intersecao',
      attributes->>'intersection_area_ha',
      attributes->>'area_overlap',
      ''
    ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
  ),
  area_alerta_ha = coalesce(
    area_alerta_ha,
    nullif(replace(regexp_replace(coalesce(
      attributes->>'area_alerta_ha',
      attributes->>'area_alerta',
      attributes->>'alert_area_ha',
      attributes->>'area_ha',
      ''
    ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
  )
where attributes is not null;

create or replace function public.geojson_to_geom(p_geojson jsonb)
returns geometry(MultiPolygon, 4674)
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  geometry_json jsonb;
  raw_geom geometry;
  valid_geom geometry;
  polygon_geom geometry;
begin
  if p_geojson is null then
    return null;
  end if;

  if lower(coalesce(p_geojson->>'type', '')) = 'feature' then
    geometry_json := p_geojson->'geometry';
  else
    geometry_json := p_geojson;
  end if;

  if geometry_json is null or geometry_json = 'null'::jsonb then
    return null;
  end if;

  raw_geom := ST_GeomFromGeoJSON(geometry_json::text);
  if raw_geom is null or ST_IsEmpty(raw_geom) then
    return null;
  end if;

  if ST_SRID(raw_geom) = 0 then
    raw_geom := ST_SetSRID(raw_geom, 4674);
  elsif ST_SRID(raw_geom) <> 4674 then
    raw_geom := ST_Transform(raw_geom, 4674);
  end if;

  valid_geom := ST_MakeValid(raw_geom);
  polygon_geom := ST_CollectionExtract(valid_geom, 3);

  if polygon_geom is null or ST_IsEmpty(polygon_geom) then
    return null;
  end if;

  return ST_Multi(polygon_geom)::geometry(MultiPolygon, 4674);
exception
  when others then
    return null;
end;
$$;

create or replace function public.refresh_geoquery_geometries(p_force boolean default false)
returns table(table_name text, updated_count bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  affected_count bigint;
begin
  update public.car_properties
  set geom = public.geojson_to_geom(geom_geojson)
  where geom_geojson is not null
    and (p_force or geom is null);
  get diagnostics affected_count = row_count;
  table_name := 'car_properties';
  updated_count := affected_count;
  return next;

  update public.incra_properties
  set geom = public.geojson_to_geom(geom_geojson)
  where geom_geojson is not null
    and (p_force or geom is null);
  get diagnostics affected_count = row_count;
  table_name := 'incra_properties';
  updated_count := affected_count;
  return next;

  update public.geo_alert_layers
  set geom = public.geojson_to_geom(geom_geojson)
  where geom_geojson is not null
    and (p_force or geom is null);
  get diagnostics affected_count = row_count;
  table_name := 'geo_alert_layers';
  updated_count := affected_count;
  return next;

  update public.geo_thematic_layers
  set geom = public.geojson_to_geom(geom_geojson)
  where geom_geojson is not null
    and (p_force or geom is null);
  get diagnostics affected_count = row_count;
  table_name := 'geo_thematic_layers';
  updated_count := affected_count;
  return next;
end;
$$;

create or replace function public.find_sigef_matches_by_car(
  p_cod_car text,
  p_min_car_overlap numeric default 0.60,
  p_limit integer default 10,
  p_buffer_meters numeric default 0
)
returns table(
  id uuid,
  organization_id uuid,
  sigef_code text,
  cnir text,
  codigo_imovel text,
  certificacao text,
  situacao text,
  municipio text,
  uf text,
  area_ha numeric,
  data_certificacao date,
  attributes jsonb,
  geom_geojson jsonb,
  intersection_area_ha numeric,
  car_area_ha numeric,
  incra_area_ha numeric,
  car_overlap_ratio numeric,
  incra_overlap_ratio numeric
)
language sql
stable
set search_path = public, extensions
as $$
  with car_target as (
    select
      c.id,
      c.geom,
      case
        when coalesce(p_buffer_meters, 0) > 0
          then ST_Buffer(c.geom::geography, p_buffer_meters)::geometry
        else c.geom
      end as match_geom,
      nullif(ST_Area(c.geom::geography) / 10000.0, 0) as car_area_ha
    from public.car_properties c
    where c.cod_car = p_cod_car
      and c.geom is not null
    order by c.organization_id nulls last, c.updated_at desc
    limit 1
  ),
  intersections as (
    select
      i.id,
      i.organization_id,
      i.sigef_code,
      i.cnir,
      i.codigo_imovel,
      i.certificacao,
      i.situacao,
      i.municipio,
      i.uf,
      i.area_ha,
      i.data_certificacao,
      i.attributes,
      i.geom_geojson,
      ST_Area(ST_Intersection(c.geom, i.geom)::geography) / 10000.0 as intersection_area_ha,
      c.car_area_ha,
      nullif(coalesce(i.area_ha, ST_Area(i.geom::geography) / 10000.0), 0) as incra_area_ha
    from car_target c
    join public.incra_properties i
      on i.geom is not null
     and ST_Intersects(i.geom, c.match_geom)
  )
  select
    intersections.id,
    intersections.organization_id,
    intersections.sigef_code,
    intersections.cnir,
    intersections.codigo_imovel,
    intersections.certificacao,
    intersections.situacao,
    intersections.municipio,
    intersections.uf,
    intersections.area_ha,
    intersections.data_certificacao,
    intersections.attributes,
    intersections.geom_geojson,
    round(intersections.intersection_area_ha::numeric, 6) as intersection_area_ha,
    round(intersections.car_area_ha::numeric, 6) as car_area_ha,
    round(intersections.incra_area_ha::numeric, 6) as incra_area_ha,
    round((intersections.intersection_area_ha / intersections.car_area_ha)::numeric, 6) as car_overlap_ratio,
    round((intersections.intersection_area_ha / intersections.incra_area_ha)::numeric, 6) as incra_overlap_ratio
  from intersections
  where intersections.car_area_ha is not null
    and intersections.incra_area_ha is not null
    and (intersections.intersection_area_ha / intersections.car_area_ha) >= coalesce(p_min_car_overlap, 0.60)
  order by
    (intersections.intersection_area_ha / intersections.car_area_ha) desc,
    intersections.intersection_area_ha desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

select * from public.refresh_geoquery_geometries(false);

notify pgrst, 'reload schema';
