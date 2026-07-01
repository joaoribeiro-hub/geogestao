-- MODULE-HUB-EXTERNAL-APPS-1
-- Hub de modulos internos, logs por organizacao e preferencias visuais por usuario.

create table if not exists public.app_modules (
  key text primary key,
  name text not null,
  description text,
  status text not null default 'em_migracao',
  route text not null,
  is_global boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_modules_status_check
    check (status in ('ativo', 'beta', 'em_migracao', 'indisponivel'))
);

create table if not exists public.organization_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

create table if not exists public.module_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  font_scale numeric not null default 1.2,
  theme_mode text not null default 'light',
  palette_key text not null default 'agrimensura_verde',
  background_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_font_scale_check check (font_scale between 0.6 and 1.75),
  constraint user_preferences_theme_mode_check check (theme_mode in ('light', 'dark'))
);

create index if not exists organization_modules_organization_id_idx
  on public.organization_modules(organization_id);

create index if not exists organization_modules_module_key_idx
  on public.organization_modules(module_key);

create index if not exists module_activity_logs_organization_id_idx
  on public.module_activity_logs(organization_id);

create index if not exists module_activity_logs_module_key_idx
  on public.module_activity_logs(module_key);

create index if not exists module_activity_logs_created_at_idx
  on public.module_activity_logs(created_at desc);

insert into public.app_modules (key, name, description, status, route, is_global)
values
  ('geogestao', 'GeoGestao', 'Central principal de operacao, servicos, clientes, financeiro e equipe.', 'ativo', '/inicio', true),
  ('meu-imovel-car', 'MeuIMOVEL-CAR', 'Consulta de CAR, SIGEF, INCRA, alertas e imoveis em migracao para modulo interno.', 'em_migracao', '/modulos/meu-imovel-car', true),
  ('buscageo', 'BuscaGEO', 'Busca e processamento geoespacial de imagens CBERS em migracao para modulo interno.', 'em_migracao', '/modulos/buscageo', true),
  ('app-2026-06-25', 'App 2026-06-25', 'Gerador RW5 Local em migracao para fluxo web com Storage por organizacao.', 'em_migracao', '/modulos/app-2026-06-25', true),
  ('app-2026-05-29', 'App 2026-05-29', 'Pasta nao encontrada no ambiente auditado; aguardando localizacao para migracao.', 'indisponivel', '/modulos/app-2026-05-29', true)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  route = excluded.route,
  is_global = excluded.is_global,
  updated_at = now();

insert into public.organization_modules (organization_id, module_key, enabled)
select organizations.id, app_modules.key, true
from public.organizations
cross join public.app_modules
on conflict (organization_id, module_key) do nothing;

do $$
begin
  if to_regclass('public.user_ui_preferences') is not null then
    insert into public.user_preferences (user_id, font_scale, theme_mode, palette_key, updated_at)
    select
      legacy.user_id,
      case
        when legacy.font_scale ~ '^[0-9]+([,.][0-9]+)?x?$'
          then least(1.75, greatest(0.6, replace(replace(legacy.font_scale, 'x', ''), ',', '.')::numeric))
        else 1.2
      end as font_scale,
      case when legacy.dark_mode then 'dark' else 'light' end as theme_mode,
      coalesce(nullif(legacy.color_palette, ''), 'agrimensura_verde') as palette_key,
      coalesce(legacy.updated_at, now()) as updated_at
    from public.user_ui_preferences legacy
    on conflict (user_id) do nothing;
  end if;
end $$;

alter table public.app_modules enable row level security;
alter table public.organization_modules enable row level security;
alter table public.module_activity_logs enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "app_modules_authenticated_select" on public.app_modules;
create policy "app_modules_authenticated_select"
  on public.app_modules for select
  to authenticated
  using (is_global = true);

drop policy if exists "organization_modules_member_select" on public.organization_modules;
create policy "organization_modules_member_select"
  on public.organization_modules for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "organization_modules_owner_write" on public.organization_modules;
create policy "organization_modules_owner_write"
  on public.organization_modules for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "module_activity_logs_member_select" on public.module_activity_logs;
create policy "module_activity_logs_member_select"
  on public.module_activity_logs for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "module_activity_logs_member_insert" on public.module_activity_logs;
create policy "module_activity_logs_member_insert"
  on public.module_activity_logs for insert
  to authenticated
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists "user_preferences_own_select" on public.user_preferences;
create policy "user_preferences_own_select"
  on public.user_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_preferences_own_write" on public.user_preferences;
create policy "user_preferences_own_write"
  on public.user_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
