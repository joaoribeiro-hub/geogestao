-- GEOQUERY corrective migration: find imported alerts by CAR code, attributes and PostGIS.
-- Does not edit previous migrations and does not depend on MapBiomas API credentials.

create extension if not exists postgis with schema extensions;

set search_path = public, extensions;

drop function if exists public.refresh_alert_geom_batch(integer);

create or replace function public.refresh_alert_geom_batch(p_limit integer default 1000)
returns table(table_name text, processed_count bigint, updated_count bigint, skipped_count bigint)
language sql
security definer
set search_path = public, extensions
as $$
  with batch as (
    select id
    from public.geo_alert_layers
    where geom_geojson is not null
      and geom is null
    order by id
    limit greatest(coalesce(p_limit, 1000), 1)
  ),
  prepared as (
    select target.id, public.geojson_to_geom(target.geom_geojson) as next_geom
    from public.geo_alert_layers target
    join batch on batch.id = target.id
  ),
  updated as (
    update public.geo_alert_layers target
    set geom = prepared.next_geom
    from prepared
    where target.id = prepared.id
      and prepared.next_geom is not null
    returning 1
  )
  select
    'geo_alert_layers'::text as table_name,
    (select count(*) from batch)::bigint as processed_count,
    (select count(*) from updated)::bigint as updated_count,
    (select count(*) from prepared where next_geom is null)::bigint as skipped_count;
$$;

drop function if exists public.find_alerts_by_car_app(text, numeric, integer);

create or replace function public.find_alerts_by_car_app(
  p_cod_car text,
  p_buffer_meters numeric default 500,
  p_limit integer default 50
)
returns table(
  id uuid,
  organization_id uuid,
  layer_type text,
  provider text,
  reference_year text,
  name text,
  cod_car text,
  cod_imovel text,
  alert_code integer,
  codigo_alerta text,
  alert_date date,
  area_ha numeric,
  area_intersecao_ha numeric,
  area_alerta_ha numeric,
  attributes jsonb,
  geom_geojson jsonb,
  bbox jsonb,
  source_id uuid,
  created_at timestamptz,
  match_type text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with current_memberships as (
    select om.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
  ),
  car_target as (
    select
      c.id,
      c.geom,
      case
        when coalesce(p_buffer_meters, 0) > 0
          then ST_Transform(ST_Buffer(c.geom::geography, p_buffer_meters)::geometry, 4674)
        else null::geometry
      end as buffer_geom
    from public.car_properties c
    where c.cod_car = p_cod_car
      and c.geom is not null
      and (
        c.organization_id is null
        or exists (
          select 1
          from current_memberships cm
          where cm.organization_id = c.organization_id
        )
      )
    order by c.organization_id nulls last, c.updated_at desc
    limit 1
  ),
  accessible_alerts as (
    select ga.*
    from public.geo_alert_layers ga
    where ga.organization_id is null
      or exists (
        select 1
        from current_memberships cm
        where cm.organization_id = ga.organization_id
      )
  ),
  candidates as (
    select ga.*, 'direct_code'::text as match_type, 1 as priority
    from accessible_alerts ga
    where ga.cod_car = p_cod_car
       or ga.cod_imovel = p_cod_car

    union all

    select ga.*, 'attributes_code'::text as match_type, 2 as priority
    from accessible_alerts ga
    where ga.attributes is not null
      and lower(ga.attributes::text) like '%' || lower(p_cod_car) || '%'

    union all

    select ga.*, 'spatial_intersection'::text as match_type, 3 as priority
    from car_target c
    join accessible_alerts ga
      on ga.geom is not null
     and ga.geom && c.geom
     and ST_Intersects(ga.geom, c.geom)

    union all

    select ga.*, 'spatial_buffer'::text as match_type, 4 as priority
    from car_target c
    join accessible_alerts ga
      on coalesce(p_buffer_meters, 0) > 0
     and c.buffer_geom is not null
     and ga.geom is not null
     and ga.geom && c.buffer_geom
     and ST_Intersects(ga.geom, c.buffer_geom)
     and not ST_Intersects(ga.geom, c.geom)
  ),
  ranked as (
    select distinct on (candidates.id)
      candidates.*
    from candidates
    order by candidates.id, candidates.priority
  )
  select
    r.id,
    r.organization_id,
    r.layer_type,
    r.provider,
    r.reference_year,
    r.name,
    coalesce(
      r.cod_car,
      nullif(r.attributes->>'cod_car', ''),
      nullif(r.attributes->>'car_code', ''),
      nullif(r.attributes->>'codigo_car', ''),
      nullif(r.attributes->>'car', ''),
      nullif(r.attributes->>'cod_car_federal', '')
    ) as cod_car,
    coalesce(
      r.cod_imovel,
      nullif(r.attributes->>'cod_imovel', ''),
      nullif(r.attributes->>'codigo_imovel', ''),
      nullif(r.attributes->>'property_code', ''),
      nullif(r.attributes->>'imovel', '')
    ) as cod_imovel,
    coalesce(
      r.alert_code,
      nullif(regexp_replace(coalesce(
        r.codigo_alerta,
        r.attributes->>'codigo_alerta',
        r.attributes->>'cod_alerta',
        r.attributes->>'alert_code',
        r.attributes->>'alerta',
        r.attributes->>'id_alerta',
        ''
      ), '[^0-9]', '', 'g'), '')::integer
    ) as alert_code,
    coalesce(
      r.codigo_alerta,
      nullif(r.attributes->>'codigo_alerta', ''),
      nullif(r.attributes->>'cod_alerta', ''),
      nullif(r.attributes->>'alert_code', ''),
      nullif(r.attributes->>'alerta', '')
    ) as codigo_alerta,
    r.alert_date,
    r.area_ha,
    coalesce(
      case
        when c.geom is not null and r.geom is not null and ST_Intersects(c.geom, r.geom)
          then ST_Area(ST_Intersection(c.geom, r.geom)::geography) / 10000.0
        else null
      end,
      r.area_intersecao_ha,
      nullif(replace(regexp_replace(coalesce(
        r.attributes->>'area_intersecao_ha',
        r.attributes->>'area_intersecao',
        r.attributes->>'intersection_area_ha',
        r.attributes->>'area_overlap',
        r.attributes->>'area_sobreposta',
        ''
      ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
    ) as area_intersecao_ha,
    coalesce(
      r.area_alerta_ha,
      r.area_ha,
      nullif(replace(regexp_replace(coalesce(
        r.attributes->>'area_alerta_ha',
        r.attributes->>'area_alerta',
        r.attributes->>'alert_area_ha',
        r.attributes->>'area_ha',
        r.attributes->>'area',
        ''
      ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
    ) as area_alerta_ha,
    r.attributes,
    r.geom_geojson,
    r.bbox,
    r.source_id,
    r.created_at,
    r.match_type
  from ranked r
  left join car_target c on true
  order by
    case r.match_type
      when 'direct_code' then 1
      when 'attributes_code' then 2
      when 'spatial_intersection' then 3
      else 4
    end,
    r.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

revoke all on function public.refresh_alert_geom_batch(integer) from public;
grant execute on function public.refresh_alert_geom_batch(integer) to authenticated;

revoke all on function public.find_alerts_by_car_app(text, numeric, integer) from public;
grant execute on function public.find_alerts_by_car_app(text, numeric, integer) to authenticated;

notify pgrst, 'reload schema';
