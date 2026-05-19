-- GEOQUERY corrective migration: alert attribute backfill and nearby alert separation.
-- Does not edit previous migrations. Keeps imported attributes intact.

create extension if not exists postgis with schema extensions;

set search_path = public, extensions;

alter table public.geo_alert_layers
  add column if not exists cod_car text,
  add column if not exists cod_imovel text,
  add column if not exists alert_code integer,
  add column if not exists codigo_alerta text,
  add column if not exists area_intersecao_ha numeric,
  add column if not exists area_alerta_ha numeric;

create or replace function public.geoquery_int_from_text(p_value text)
returns integer
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  digits text;
  value_bigint bigint;
begin
  digits := nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '');
  if digits is null then
    return null;
  end if;

  value_bigint := digits::bigint;
  if value_bigint > 2147483647 then
    return null;
  end if;

  return value_bigint::integer;
exception
  when others then
    return null;
end;
$$;

update public.geo_alert_layers
set
  cod_car = coalesce(
    cod_car,
    nullif(attributes->>'cod_car', ''),
    nullif(attributes->>'cod_imovel', ''),
    nullif(attributes->>'codigo_imovel', ''),
    nullif(attributes->>'cod_imovel_car', ''),
    nullif(attributes->>'car_code', ''),
    nullif(attributes->>'carCode', ''),
    nullif(attributes->>'carcode', ''),
    nullif(attributes->>'codigo_car', ''),
    nullif(attributes->>'codigo_imovel_rural', '')
  ),
  cod_imovel = coalesce(
    cod_imovel,
    nullif(attributes->>'cod_imovel', ''),
    nullif(attributes->>'codigo_imovel', ''),
    nullif(attributes->>'codigo_imovel_rural', ''),
    nullif(attributes->>'property_code', ''),
    nullif(attributes->>'imovel', '')
  ),
  codigo_alerta = coalesce(
    codigo_alerta,
    nullif(attributes->>'codigo_alerta', ''),
    nullif(attributes->>'cod_alerta', ''),
    nullif(attributes->>'alert_code', ''),
    nullif(attributes->>'alertCode', ''),
    nullif(attributes->>'alert_id', ''),
    nullif(attributes->>'id_alerta', ''),
    nullif(attributes->>'code', ''),
    nullif(attributes->>'codigo', '')
  ),
  alert_code = coalesce(
    alert_code,
    public.geoquery_int_from_text(coalesce(
      attributes->>'alert_code',
      attributes->>'cod_alerta',
      attributes->>'codigo_alerta',
      attributes->>'id_alerta',
      attributes->>'code',
      attributes->>'codigo',
      attributes->>'alertCode',
      attributes->>'alert_id',
      ''
    ))
  ),
  area_alerta_ha = coalesce(
    area_alerta_ha,
    nullif(replace(regexp_replace(coalesce(
      attributes->>'area_alerta',
      attributes->>'area_ha',
      attributes->>'area',
      attributes->>'area_alerta_ha',
      ''
    ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
  ),
  area_intersecao_ha = coalesce(
    area_intersecao_ha,
    nullif(replace(regexp_replace(coalesce(
      attributes->>'area_intersecao',
      attributes->>'area_intersecao_ha',
      attributes->>'intersection_area',
      attributes->>'intersection_area_ha',
      ''
    ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
  )
where attributes is not null;

drop function if exists public.find_alerts_by_car_app(text, numeric, integer);
drop function if exists public.find_alerts_by_car_app(text, boolean, numeric, integer);

create or replace function public.find_alerts_by_car_app(
  p_cod_car text,
  p_include_nearby boolean default false,
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
  distance_m numeric,
  match_type text,
  is_spatially_confirmed boolean,
  is_nearby_only boolean,
  attributes jsonb,
  geom_geojson jsonb,
  bbox jsonb,
  source_id uuid,
  created_at timestamptz
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
  direct_code as (
    select ga.*, 'direct_code'::text as match_type, 1 as priority
    from accessible_alerts ga
    where ga.cod_car = p_cod_car
       or ga.cod_imovel = p_cod_car
  ),
  attributes_code as (
    select ga.*, 'attributes_code'::text as match_type, 2 as priority
    from accessible_alerts ga
    where ga.attributes is not null
      and lower(ga.attributes::text) like '%' || lower(p_cod_car) || '%'
  ),
  spatial_intersection as (
    select ga.*, 'spatial_intersection'::text as match_type, 3 as priority
    from car_target c
    join accessible_alerts ga
      on ga.geom is not null
     and ga.geom && c.geom
     and ST_Intersects(ga.geom, c.geom)
  ),
  spatial_buffer as (
    select ga.*, 'spatial_buffer'::text as match_type, 4 as priority
    from car_target c
    join accessible_alerts ga
      on p_include_nearby is true
     and coalesce(p_buffer_meters, 0) > 0
     and c.buffer_geom is not null
     and ga.geom is not null
     and ga.geom && c.buffer_geom
     and ST_Intersects(ga.geom, c.buffer_geom)
     and not ST_Intersects(ga.geom, c.geom)
  ),
  candidates as (
    select * from direct_code
    union all
    select * from attributes_code
    union all
    select * from spatial_intersection
    union all
    select * from spatial_buffer
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
      nullif(r.attributes->>'cod_imovel', ''),
      nullif(r.attributes->>'codigo_imovel', ''),
      nullif(r.attributes->>'cod_imovel_car', ''),
      nullif(r.attributes->>'car_code', ''),
      nullif(r.attributes->>'carCode', ''),
      nullif(r.attributes->>'carcode', ''),
      nullif(r.attributes->>'codigo_car', ''),
      nullif(r.attributes->>'codigo_imovel_rural', '')
    ) as cod_car,
    coalesce(
      r.cod_imovel,
      nullif(r.attributes->>'cod_imovel', ''),
      nullif(r.attributes->>'codigo_imovel', ''),
      nullif(r.attributes->>'codigo_imovel_rural', ''),
      nullif(r.attributes->>'property_code', ''),
      nullif(r.attributes->>'imovel', '')
    ) as cod_imovel,
    coalesce(
      r.alert_code,
      public.geoquery_int_from_text(coalesce(
        r.codigo_alerta,
        r.attributes->>'alert_code',
        r.attributes->>'cod_alerta',
        r.attributes->>'codigo_alerta',
        r.attributes->>'id_alerta',
        r.attributes->>'code',
        r.attributes->>'codigo',
        r.attributes->>'alertCode',
        r.attributes->>'alert_id',
        ''
      ))
    ) as alert_code,
    coalesce(
      r.codigo_alerta,
      nullif(r.attributes->>'codigo_alerta', ''),
      nullif(r.attributes->>'cod_alerta', ''),
      nullif(r.attributes->>'alert_code', ''),
      nullif(r.attributes->>'alertCode', ''),
      nullif(r.attributes->>'alert_id', ''),
      nullif(r.attributes->>'id_alerta', ''),
      nullif(r.attributes->>'code', ''),
      nullif(r.attributes->>'codigo', '')
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
        r.attributes->>'area_intersecao',
        r.attributes->>'area_intersecao_ha',
        r.attributes->>'intersection_area',
        r.attributes->>'intersection_area_ha',
        ''
      ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
    ) as area_intersecao_ha,
    coalesce(
      r.area_alerta_ha,
      r.area_ha,
      nullif(replace(regexp_replace(coalesce(
        r.attributes->>'area_alerta',
        r.attributes->>'area_ha',
        r.attributes->>'area',
        r.attributes->>'area_alerta_ha',
        ''
      ), '[^0-9,.-]', '', 'g'), ',', '.'), '')::numeric
    ) as area_alerta_ha,
    case
      when c.geom is not null and r.geom is not null then ST_Distance(c.geom::geography, r.geom::geography)
      else null
    end as distance_m,
    r.match_type,
    case
      when c.geom is not null and r.geom is not null then ST_Intersects(c.geom, r.geom)
      else false
    end as is_spatially_confirmed,
    r.match_type = 'spatial_buffer' as is_nearby_only,
    r.attributes,
    r.geom_geojson,
    r.bbox,
    r.source_id,
    r.created_at
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

revoke all on function public.find_alerts_by_car_app(text, boolean, numeric, integer) from public;
grant execute on function public.find_alerts_by_car_app(text, boolean, numeric, integer) to authenticated;

notify pgrst, 'reload schema';
