-- GEOQUERY-3 / Migration 010 manual split
-- Parte 2: funcoes para converter GeoJSON em geometry e atualizar geometrias.
-- Rode depois da parte 1 no Supabase de teste.

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
