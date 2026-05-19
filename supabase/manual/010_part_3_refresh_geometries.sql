-- GEOQUERY-3 / Migration 010 manual split
-- Parte 3: backfill de campos MapBiomas e refresh das geometrias.
-- Esta e a parte mais pesada em bases grandes. Rode depois da parte 2 no Supabase de teste.

set search_path = public, extensions;

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

select * from public.refresh_geoquery_geometries(false);
