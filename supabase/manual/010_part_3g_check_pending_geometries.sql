-- GEOQUERY-3 / Migration 010 manual split
-- Helper: confira pendencias de geometria apos rodar os lotes 3C a 3F.

select 'car_properties' as table_name, count(*) as pending_geom
from public.car_properties
where geom_geojson is not null and geom is null

union all

select 'incra_properties' as table_name, count(*) as pending_geom
from public.incra_properties
where geom_geojson is not null and geom is null

union all

select 'geo_alert_layers' as table_name, count(*) as pending_geom
from public.geo_alert_layers
where geom_geojson is not null and geom is null

union all

select 'geo_thematic_layers' as table_name, count(*) as pending_geom
from public.geo_thematic_layers
where geom_geojson is not null and geom is null;
