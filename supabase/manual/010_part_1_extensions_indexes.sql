-- GEOQUERY-3 / Migration 010 manual split
-- Parte 1: extensao PostGIS, colunas e indices.
-- Rode primeiro no Supabase de teste.

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
