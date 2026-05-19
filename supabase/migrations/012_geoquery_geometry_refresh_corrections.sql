-- GEOQUERY corrective migration: robust GeoJSON conversion and batch geometry refresh.
-- Mirrors the manual Supabase adjustments made after importing large CAR/INCRA bases.
-- This migration is additive/corrective and does not edit previous migrations.

create extension if not exists postgis with schema extensions;

set search_path = public, extensions;

create or replace function public.geojson_to_geom(p_geojson jsonb)
returns geometry(MultiPolygon, 4674)
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  geometry_json jsonb;
  raw_geom geometry;
  fixed_geom geometry;
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

  raw_geom := ST_Force2D(raw_geom);

  if ST_SRID(raw_geom) = 0 then
    raw_geom := ST_SetSRID(raw_geom, 4674);
  elsif ST_SRID(raw_geom) <> 4674 then
    raw_geom := ST_Transform(raw_geom, 4674);
  end if;

  fixed_geom := ST_MakeValid(raw_geom);
  polygon_geom := ST_CollectionExtract(fixed_geom, 3);

  if polygon_geom is null or ST_IsEmpty(polygon_geom) then
    return null;
  end if;

  return ST_Multi(polygon_geom)::geometry(MultiPolygon, 4674);
exception
  when others then
    return null;
end;
$$;

create or replace function public.refresh_car_geom_batch(p_limit integer default 1000)
returns table(table_name text, processed_count bigint, updated_count bigint, skipped_count bigint)
language sql
security definer
set search_path = public, extensions
as $$
  with batch as (
    select id
    from public.car_properties
    where geom_geojson is not null
      and geom is null
    order by id
    limit greatest(coalesce(p_limit, 1000), 1)
  ),
  prepared as (
    select target.id, public.geojson_to_geom(target.geom_geojson) as next_geom
    from public.car_properties target
    join batch on batch.id = target.id
  ),
  updated as (
    update public.car_properties target
    set geom = prepared.next_geom
    from prepared
    where target.id = prepared.id
      and prepared.next_geom is not null
    returning 1
  )
  select
    'car_properties'::text as table_name,
    (select count(*) from batch)::bigint as processed_count,
    (select count(*) from updated)::bigint as updated_count,
    (select count(*) from prepared where next_geom is null)::bigint as skipped_count;
$$;

create or replace function public.refresh_incra_geom_batch(p_limit integer default 1000)
returns table(table_name text, processed_count bigint, updated_count bigint, skipped_count bigint)
language sql
security definer
set search_path = public, extensions
as $$
  with batch as (
    select id
    from public.incra_properties
    where geom_geojson is not null
      and geom is null
    order by id
    limit greatest(coalesce(p_limit, 1000), 1)
  ),
  prepared as (
    select target.id, public.geojson_to_geom(target.geom_geojson) as next_geom
    from public.incra_properties target
    join batch on batch.id = target.id
  ),
  updated as (
    update public.incra_properties target
    set geom = prepared.next_geom
    from prepared
    where target.id = prepared.id
      and prepared.next_geom is not null
    returning 1
  )
  select
    'incra_properties'::text as table_name,
    (select count(*) from batch)::bigint as processed_count,
    (select count(*) from updated)::bigint as updated_count,
    (select count(*) from prepared where next_geom is null)::bigint as skipped_count;
$$;

create or replace function public.find_sigef_matches_by_car_simple(
  p_cod_car text,
  p_min_car_overlap numeric default 0.60,
  p_limit integer default 10
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
security definer
set search_path = public, extensions
as $$
  select *
  from public.find_sigef_matches_by_car(
    p_cod_car,
    p_min_car_overlap,
    p_limit,
    0
  );
$$;

revoke all on function public.find_sigef_matches_by_car_simple(text, numeric, integer) from public;
grant execute on function public.find_sigef_matches_by_car_simple(text, numeric, integer) to authenticated;

notify pgrst, 'reload schema';
