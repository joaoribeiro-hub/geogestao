-- GEOQUERY-3 / Migration 010 manual split
-- Parte 3D: refresh em lote das geometrias SIGEF/INCRA.
-- Rode depois da parte 3C. Repita ate processed_count = 0.
-- Se o SQL Editor ainda falhar, reduza o limit de 500 para 100.

set search_path = public, extensions;

with batch as (
  select id
  from public.incra_properties
  where geom_geojson is not null
    and geom is null
  order by id
  limit 500
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
  'incra_properties_geom' as step,
  (select count(*) from batch) as processed_count,
  (select count(*) from updated) as updated_count,
  (select count(*) from prepared where next_geom is null) as skipped_count;
