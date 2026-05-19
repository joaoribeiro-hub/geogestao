-- GEOQUERY-3 / Migration 010 manual split
-- Parte 3A: backfill em lote dos identificadores de alertas MapBiomas.
-- Rode depois da parte 2. Repita ate updated_count = 0.
-- Se o SQL Editor ainda falhar, reduza o limit de 1000 para 200.

set search_path = public, extensions;

with batch as (
  select id
  from public.geo_alert_layers
  where attributes is not null
    and (
      (
        cod_car is null
        and coalesce(
          nullif(attributes->>'cod_car', ''),
          nullif(attributes->>'car_code', ''),
          nullif(attributes->>'codigo_car', ''),
          nullif(attributes->>'car', ''),
          nullif(attributes->>'cod_car_federal', '')
        ) is not null
      )
      or (
        cod_imovel is null
        and coalesce(
          nullif(attributes->>'cod_imovel', ''),
          nullif(attributes->>'codigo_imovel', ''),
          nullif(attributes->>'property_code', ''),
          nullif(attributes->>'imovel', '')
        ) is not null
      )
      or (
        codigo_alerta is null
        and coalesce(
          nullif(attributes->>'codigo_alerta', ''),
          nullif(attributes->>'cod_alerta', ''),
          nullif(attributes->>'alert_code', ''),
          nullif(attributes->>'alerta', '')
        ) is not null
      )
    )
  order by id
  limit 1000
),
updated as (
  update public.geo_alert_layers target
  set
    cod_car = coalesce(
      target.cod_car,
      nullif(target.attributes->>'cod_car', ''),
      nullif(target.attributes->>'car_code', ''),
      nullif(target.attributes->>'codigo_car', ''),
      nullif(target.attributes->>'car', ''),
      nullif(target.attributes->>'cod_car_federal', '')
    ),
    cod_imovel = coalesce(
      target.cod_imovel,
      nullif(target.attributes->>'cod_imovel', ''),
      nullif(target.attributes->>'codigo_imovel', ''),
      nullif(target.attributes->>'property_code', ''),
      nullif(target.attributes->>'imovel', '')
    ),
    codigo_alerta = coalesce(
      target.codigo_alerta,
      nullif(target.attributes->>'codigo_alerta', ''),
      nullif(target.attributes->>'cod_alerta', ''),
      nullif(target.attributes->>'alert_code', ''),
      nullif(target.attributes->>'alerta', '')
    )
  from batch
  where target.id = batch.id
  returning 1
)
select 'geo_alert_layers_identifiers' as step, count(*) as updated_count
from updated;
