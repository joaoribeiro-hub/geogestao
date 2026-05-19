-- GEOQUERY-3 / Migration 010 manual split
-- Parte 3B: backfill em lote dos codigos/areas numericas de alertas MapBiomas.
-- Rode depois da parte 3A. Repita ate updated_count = 0.
-- Se o SQL Editor ainda falhar, reduza o limit de 1000 para 200.

set search_path = public, extensions;

with batch as (
  select id
  from public.geo_alert_layers
  where attributes is not null
    and (
      (
        alert_code is null
        and nullif(regexp_replace(coalesce(
          attributes->>'alert_code',
          attributes->>'codigo_alerta',
          attributes->>'cod_alerta',
          attributes->>'alerta',
          attributes->>'id_alerta',
          ''
        ), '[^0-9]', '', 'g'), '') is not null
      )
      or (
        area_intersecao_ha is null
        and nullif(replace(regexp_replace(coalesce(
          attributes->>'area_intersecao_ha',
          attributes->>'area_intersecao',
          attributes->>'intersection_area_ha',
          attributes->>'area_overlap',
          ''
        ), '[^0-9,.-]', '', 'g'), ',', '.'), '') is not null
      )
      or (
        area_alerta_ha is null
        and nullif(replace(regexp_replace(coalesce(
          attributes->>'area_alerta_ha',
          attributes->>'area_alerta',
          attributes->>'alert_area_ha',
          attributes->>'area_ha',
          ''
        ), '[^0-9,.-]', '', 'g'), ',', '.'), '') is not null
      )
    )
  order by id
  limit 1000
),
updated as (
  update public.geo_alert_layers target
  set
    alert_code = coalesce(
      target.alert_code,
      nullif(regexp_replace(coalesce(
        target.attributes->>'alert_code',
        target.attributes->>'codigo_alerta',
        target.attributes->>'cod_alerta',
        target.attributes->>'alerta',
        target.attributes->>'id_alerta',
        ''
      ), '[^0-9]', '', 'g'), '')::integer
    ),
    area_intersecao_ha = coalesce(
      target.area_intersecao_ha,
      nullif(replace(regexp_replace(coalesce(
        target.attributes->>'area_intersecao_ha',
        target.attributes->>'area_intersecao',
        target.attributes->>'intersection_area_ha',
        target.attributes->>'area_overlap',
        ''
      ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
    ),
    area_alerta_ha = coalesce(
      target.area_alerta_ha,
      nullif(replace(regexp_replace(coalesce(
        target.attributes->>'area_alerta_ha',
        target.attributes->>'area_alerta',
        target.attributes->>'alert_area_ha',
        target.attributes->>'area_ha',
        ''
      ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
    )
  from batch
  where target.id = batch.id
  returning 1
)
select 'geo_alert_layers_numbers' as step, count(*) as updated_count
from updated;
