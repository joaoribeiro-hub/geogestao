-- TOOLS-NEXT-PHASES-1
-- Proximas fases funcionais de Portal do Cliente, Desenhar GEO e Analise Ambiental.

create table if not exists public.client_portals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_card_id uuid not null references public.service_cards(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  is_active boolean not null default true,
  public_title text,
  public_summary text,
  show_basic_info boolean not null default true,
  show_progress boolean not null default true,
  show_stages boolean not null default true,
  show_documents boolean not null default false,
  show_responsible boolean not null default false,
  show_values boolean not null default false,
  progress_override integer,
  last_published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, service_card_id),
  constraint client_portals_progress_override_check
    check (progress_override is null or (progress_override >= 0 and progress_override <= 100))
);

create table if not exists public.client_portal_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portal_id uuid not null references public.client_portals(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Link principal',
  access_mode text not null default 'private_link',
  pin_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_portal_links_access_mode_check
    check (access_mode in ('private_link', 'pin', 'magic_link'))
);

create table if not exists public.client_portal_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portal_id uuid not null references public.client_portals(id) on delete cascade,
  title text not null,
  summary text,
  update_type text not null default 'general',
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.client_portal_access_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portal_id uuid not null references public.client_portals(id) on delete cascade,
  link_id uuid references public.client_portal_links(id) on delete set null,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.module_environmental_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'aguardando',
  original_filename text,
  input_storage_path text,
  input_mime_type text,
  input_size_bytes bigint not null default 0,
  requested_layers text[] not null default array['vegetacao', 'agua', 'drenagem']::text[],
  provider_order text[] not null default array['local', 'gee']::text[],
  area_ha numeric,
  bbox jsonb,
  confidence_summary jsonb not null default '{}'::jsonb,
  result_storage_path text,
  logs jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint module_environmental_analysis_jobs_status_check
    check (status in (
      'aguardando',
      'lendo_area',
      'buscando_imagens',
      'processando_vegetacao',
      'processando_agua',
      'processando_drenagem',
      'cruzando_bases',
      'vetorizando',
      'gerando_kml',
      'concluido',
      'worker_pendente',
      'erro'
    ))
);

create index if not exists client_portals_org_service_idx
  on public.client_portals(organization_id, service_card_id);

create index if not exists client_portal_links_portal_idx
  on public.client_portal_links(portal_id);

create index if not exists client_portal_links_token_hash_idx
  on public.client_portal_links(token_hash);

create index if not exists client_portal_updates_portal_idx
  on public.client_portal_updates(portal_id, published_at desc);

create index if not exists client_portal_access_logs_portal_idx
  on public.client_portal_access_logs(portal_id, created_at desc);

create index if not exists module_environmental_analysis_jobs_org_created_idx
  on public.module_environmental_analysis_jobs(organization_id, created_at desc);

create index if not exists module_environmental_analysis_jobs_org_status_idx
  on public.module_environmental_analysis_jobs(organization_id, status);

alter table public.client_portals enable row level security;
alter table public.client_portal_links enable row level security;
alter table public.client_portal_updates enable row level security;
alter table public.client_portal_access_logs enable row level security;
alter table public.module_environmental_analysis_jobs enable row level security;

drop policy if exists "client_portals_member_select" on public.client_portals;
create policy "client_portals_member_select"
  on public.client_portals for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "client_portals_member_write" on public.client_portals;
create policy "client_portals_member_write"
  on public.client_portals for all
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "client_portal_links_member_select" on public.client_portal_links;
create policy "client_portal_links_member_select"
  on public.client_portal_links for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "client_portal_links_member_write" on public.client_portal_links;
create policy "client_portal_links_member_write"
  on public.client_portal_links for all
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "client_portal_updates_member_select" on public.client_portal_updates;
create policy "client_portal_updates_member_select"
  on public.client_portal_updates for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "client_portal_updates_member_write" on public.client_portal_updates;
create policy "client_portal_updates_member_write"
  on public.client_portal_updates for all
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "client_portal_access_logs_member_select" on public.client_portal_access_logs;
create policy "client_portal_access_logs_member_select"
  on public.client_portal_access_logs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "environmental_jobs_member_select" on public.module_environmental_analysis_jobs;
create policy "environmental_jobs_member_select"
  on public.module_environmental_analysis_jobs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "environmental_jobs_member_insert" on public.module_environmental_analysis_jobs;
create policy "environmental_jobs_member_insert"
  on public.module_environmental_analysis_jobs for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()) and user_id = auth.uid());

drop policy if exists "environmental_jobs_member_update" on public.module_environmental_analysis_jobs;
create policy "environmental_jobs_member_update"
  on public.module_environmental_analysis_jobs for update
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop function if exists public.get_public_client_portal(text);

create or replace function public.get_public_client_portal(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link_record public.client_portal_links%rowtype;
  portal_record public.client_portals%rowtype;
  payload jsonb;
begin
  select *
  into link_record
  from public.client_portal_links
  where token_hash = p_token_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if link_record.id is null then
    return null;
  end if;

  select *
  into portal_record
  from public.client_portals
  where id = link_record.portal_id
    and is_active = true
  limit 1;

  if portal_record.id is null then
    return null;
  end if;

  update public.client_portal_links
  set last_access_at = now()
  where id = link_record.id;

  insert into public.client_portal_access_logs (
    organization_id,
    portal_id,
    link_id,
    event,
    metadata
  )
  values (
    portal_record.organization_id,
    portal_record.id,
    link_record.id,
    'portal_viewed',
    '{}'::jsonb
  );

  select jsonb_build_object(
    'organization', jsonb_build_object(
      'name', org.name
    ),
    'client', case
      when cli.id is null then null
      else jsonb_build_object('name', cli.name)
    end,
    'service', jsonb_build_object(
      'id', svc.id,
      'title', coalesce(portal_record.public_title, svc.title),
      'description', coalesce(portal_record.public_summary, svc.description),
      'dueDate', svc.due_date,
      'progress', coalesce(portal_record.progress_override, svc.checklist_percent, 0),
      'updatedAt', svc.updated_at
    ),
    'column', jsonb_build_object(
      'name', col.name,
      'slug', col.slug
    ),
    'stages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'title', item.title,
          'isDone', item.is_done,
          'dueDate', item.due_date,
          'completedAt', item.completed_at,
          'position', item.position
        )
        order by item.position, item.created_at
      )
      from public.checklists checklist
      join public.checklist_items item on item.checklist_id = checklist.id
      where checklist.service_card_id = svc.id
        and checklist.checklist_type = 'steps'
        and item.deleted_at is null
        and item.archived_at is null
    ), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'title', update_item.title,
          'summary', update_item.summary,
          'publishedAt', update_item.published_at
        )
        order by update_item.published_at desc
      )
      from public.client_portal_updates update_item
      where update_item.portal_id = portal_record.id
    ), '[]'::jsonb)
  )
  into payload
  from public.service_cards svc
  join public.organizations org on org.id = svc.organization_id
  left join public.clients cli on cli.id = svc.client_id and cli.organization_id = svc.organization_id
  left join public.service_columns col on col.id = svc.column_id
  where svc.id = portal_record.service_card_id
    and svc.organization_id = portal_record.organization_id;

  return payload;
end;
$$;

grant execute on function public.get_public_client_portal(text) to anon, authenticated;

notify pgrst, 'reload schema';
