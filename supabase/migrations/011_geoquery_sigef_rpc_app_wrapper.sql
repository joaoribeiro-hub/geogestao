-- GEOQUERY-3 fix: app-facing RPC for CAR x SIGEF spatial matching.
-- Keeps the original 010 function untouched and avoids authenticated RLS overhead
-- during the expensive PostGIS intersection, while still enforcing organization access.

set search_path = public, extensions;

create or replace function public.find_sigef_matches_by_car_app(
  p_cod_car text,
  p_min_car_overlap numeric default 0.60,
  p_limit integer default 10,
  p_buffer_meters numeric default 0
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
        else c.geom
      end as match_geom,
      nullif(ST_Area(c.geom::geography) / 10000.0, 0) as car_area_ha
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
  intersections as (
    select
      i.id,
      i.organization_id,
      i.sigef_code,
      i.cnir,
      i.codigo_imovel,
      i.certificacao,
      i.situacao,
      i.municipio,
      i.uf,
      i.area_ha,
      i.data_certificacao,
      i.attributes,
      i.geom_geojson,
      ST_Area(ST_Intersection(c.geom, i.geom)::geography) / 10000.0 as intersection_area_ha,
      c.car_area_ha,
      nullif(coalesce(i.area_ha, ST_Area(i.geom::geography) / 10000.0), 0) as incra_area_ha
    from car_target c
    join public.incra_properties i
      on i.geom is not null
     and i.geom && c.match_geom
     and ST_Intersects(i.geom, c.match_geom)
     and (
       i.organization_id is null
       or exists (
         select 1
         from current_memberships cm
         where cm.organization_id = i.organization_id
       )
     )
  )
  select
    intersections.id,
    intersections.organization_id,
    intersections.sigef_code,
    intersections.cnir,
    intersections.codigo_imovel,
    intersections.certificacao,
    intersections.situacao,
    intersections.municipio,
    intersections.uf,
    intersections.area_ha,
    intersections.data_certificacao,
    intersections.attributes,
    intersections.geom_geojson,
    round(intersections.intersection_area_ha::numeric, 6) as intersection_area_ha,
    round(intersections.car_area_ha::numeric, 6) as car_area_ha,
    round(intersections.incra_area_ha::numeric, 6) as incra_area_ha,
    round((intersections.intersection_area_ha / intersections.car_area_ha)::numeric, 6) as car_overlap_ratio,
    round((intersections.intersection_area_ha / intersections.incra_area_ha)::numeric, 6) as incra_overlap_ratio
  from intersections
  where intersections.car_area_ha is not null
    and intersections.incra_area_ha is not null
    and (intersections.intersection_area_ha / intersections.car_area_ha) >= coalesce(p_min_car_overlap, 0.60)
  order by
    (intersections.intersection_area_ha / intersections.car_area_ha) desc,
    intersections.intersection_area_ha desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

revoke all on function public.find_sigef_matches_by_car_app(text, numeric, integer, numeric) from public;
grant execute on function public.find_sigef_matches_by_car_app(text, numeric, integer, numeric) to authenticated;

notify pgrst, 'reload schema';
