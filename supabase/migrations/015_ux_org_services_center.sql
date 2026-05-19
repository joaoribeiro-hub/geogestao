-- FASE UX-ORG-SERVICES-1
-- Servicos como centro do sistema, base multiempresa e fluxo GEO simplificado.
-- Execute primeiro no Supabase de teste.

alter table if exists public.organizations
  add column if not exists slug text;

update public.organizations
set slug = lower(regexp_replace(coalesce(trade_name, name), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

create unique index if not exists organizations_slug_unique_idx
  on public.organizations(slug)
  where slug is not null;

insert into public.organizations (
  name,
  trade_name,
  slug,
  status,
  storage_quota_mb,
  storage_used_bytes,
  plan_id
)
select
  'Terras Reunidas',
  'Terras Reunidas',
  'terras-reunidas',
  'active',
  coalesce(p.storage_quota_mb, 1024),
  0,
  p.id
from public.plans p
where p.slug = 'gratuito'
  and not exists (
    select 1 from public.organizations o where o.slug = 'terras-reunidas'
  )
limit 1;

insert into public.organizations (
  name,
  trade_name,
  slug,
  status,
  storage_quota_mb,
  storage_used_bytes
)
select
  'Terras Reunidas',
  'Terras Reunidas',
  'terras-reunidas',
  'active',
  1024,
  0
where not exists (
  select 1 from public.organizations o where o.slug = 'terras-reunidas'
);

create table if not exists public.service_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  service_card_id uuid not null references public.service_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'responsavel',
  created_at timestamptz not null default now(),
  unique (service_card_id, user_id)
);

create table if not exists public.service_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  service_card_id uuid not null references public.service_cards(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists service_members_organization_id_idx
  on public.service_members(organization_id);
create index if not exists service_members_service_card_id_idx
  on public.service_members(service_card_id);
create index if not exists service_events_organization_service_idx
  on public.service_events(organization_id, service_card_id, created_at desc);

alter table public.service_members enable row level security;
alter table public.service_events enable row level security;

drop policy if exists "service_members_select_member" on public.service_members;
create policy "service_members_select_member"
  on public.service_members for select
  to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "service_members_crud_member" on public.service_members;
create policy "service_members_crud_member"
  on public.service_members for all
  to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

drop policy if exists "service_events_select_member" on public.service_events;
create policy "service_events_select_member"
  on public.service_events for select
  to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "service_events_insert_member" on public.service_events;
create policy "service_events_insert_member"
  on public.service_events for insert
  to authenticated
  with check (public.is_organization_member(organization_id));

with geo_board as (
  select id from public.service_boards where slug = 'georreferenciamento' limit 1
)
insert into public.service_columns (id, board_id, name, slug, position)
select *
from (
  values
    ('11000000-0000-4000-8000-000000000006'::uuid, (select id from geo_board), 'Aguardando documentos', 'aguardando-documentos', 1),
    ('11000000-0000-4000-8000-000000000007'::uuid, (select id from geo_board), 'Proposta/Contrato', 'proposta-contrato', 2),
    ('11000000-0000-4000-8000-000000000001'::uuid, (select id from geo_board), 'Geo em Andamento', 'geo-em-andamento', 3),
    ('11000000-0000-4000-8000-000000000008'::uuid, (select id from geo_board), 'Prioridade', 'prioridade', 4),
    ('11000000-0000-4000-8000-000000000002'::uuid, (select id from geo_board), 'Geo Protocolado no Cartorio', 'geo-protocolado-cartorio', 5),
    ('11000000-0000-4000-8000-000000000003'::uuid, (select id from geo_board), 'Geo Protocolado no INCRA', 'geo-protocolado-incra', 6),
    ('11000000-0000-4000-8000-000000000004'::uuid, (select id from geo_board), 'Geo - Pendencia de Confrontante', 'geo-pendencia-confrontante', 7),
    ('11000000-0000-4000-8000-000000000005'::uuid, (select id from geo_board), 'Geo Concluido', 'geo-concluido', 8)
) as desired(id, board_id, name, slug, position)
where desired.board_id is not null
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position;

notify pgrst, 'reload schema';

