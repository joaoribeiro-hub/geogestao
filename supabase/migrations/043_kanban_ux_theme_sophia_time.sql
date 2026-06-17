-- KANBAN-UX-THEME-SOPHIA-TIME-1
-- Remove "Aguardando documentos" dos fluxos exibidos e move cards antigos
-- para a primeira coluna operacional valida de cada quadro.

with desired(board_slug, name, slug, position) as (
  values
    ('georreferenciamento', 'Geo em Andamento', 'geo-em-andamento', 1),
    ('georreferenciamento', 'Prioridade maxima', 'prioridade_maxima', 2),
    ('georreferenciamento', 'Prioridade', 'prioridade', 3),
    ('georreferenciamento', 'Em atraso', 'em-atraso', 4),
    ('georreferenciamento', 'Geo Protocolado no Cartorio', 'geo-protocolado-cartorio', 5),
    ('georreferenciamento', 'Geo Protocolado no INCRA', 'geo-protocolado-incra', 6),
    ('georreferenciamento', 'Geo - Pendencia de Confrontante', 'geo-pendencia-confrontante', 7),
    ('georreferenciamento', 'Antigos a concluir', 'antigos-a-concluir', 8),
    ('georreferenciamento', 'Geo Concluido', 'geo-concluido', 9),
    ('georreferenciamento', 'Servico perdido', 'servico-perdido', 10),

    ('car', 'CAR em Retificacao', 'car-em-retificacao', 1),
    ('car', 'CAR em Andamento', 'car-em-andamento', 2),
    ('car', 'Prioridade maxima', 'prioridade_maxima', 3),
    ('car', 'Prioridade', 'prioridade', 4),
    ('car', 'Em atraso', 'em-atraso', 5),
    ('car', 'Aguardando Sincronizacao', 'aguardando-sincronizacao', 6),
    ('car', 'Antigos a concluir', 'antigos-a-concluir', 7),
    ('car', 'CAR Concluido', 'car-concluido', 8),

    ('itr-ccir', 'Proposta/Contrato', 'proposta-contrato', 1),
    ('itr-ccir', 'ITR/CCIR em Andamento', 'itr-ccir-em-andamento', 2),
    ('itr-ccir', 'Prioridade maxima', 'prioridade_maxima', 3),
    ('itr-ccir', 'Prioridade', 'prioridade', 4),
    ('itr-ccir', 'Em atraso', 'em-atraso', 5),
    ('itr-ccir', 'Protocolado/Enviado', 'protocolado-enviado', 6),
    ('itr-ccir', 'Antigos a concluir', 'antigos-a-concluir', 7),
    ('itr-ccir', 'Concluido', 'concluido', 8),
    ('itr-ccir', 'Servico perdido', 'servico-perdido', 9),

    ('outros-servicos', 'Proposta/Contrato', 'proposta-contrato', 1),
    ('outros-servicos', 'Em Andamento', 'em-andamento', 2),
    ('outros-servicos', 'Prioridade maxima', 'prioridade_maxima', 3),
    ('outros-servicos', 'Prioridade', 'prioridade', 4),
    ('outros-servicos', 'Em atraso', 'em-atraso', 5),
    ('outros-servicos', 'Antigos a concluir', 'antigos-a-concluir', 6),
    ('outros-servicos', 'Concluido', 'concluido', 7),
    ('outros-servicos', 'Servico perdido', 'servico-perdido', 8)
),
upserted as (
  insert into public.service_columns (board_id, name, slug, position)
  select service_boards.id, desired.name, desired.slug, desired.position
  from desired
  join public.service_boards on service_boards.slug = desired.board_slug
  on conflict (board_id, slug) do update
  set name = excluded.name,
      position = excluded.position,
      updated_at = now()
  returning id
),
targets as (
  select
    service_boards.id as board_id,
    service_boards.slug as board_slug,
    service_columns.id as target_column_id
  from public.service_boards
  join public.service_columns
    on service_columns.board_id = service_boards.id
  where
    (service_boards.slug = 'georreferenciamento' and service_columns.slug = 'geo-em-andamento')
    or (service_boards.slug = 'car' and service_columns.slug = 'car-em-retificacao')
    or (service_boards.slug = 'itr-ccir' and service_columns.slug = 'proposta-contrato')
    or (service_boards.slug = 'outros-servicos' and service_columns.slug = 'proposta-contrato')
),
awaiting_columns as (
  select service_columns.id as source_column_id, targets.target_column_id
  from public.service_columns
  join public.service_boards on service_boards.id = service_columns.board_id
  join targets on targets.board_id = service_boards.id
  where service_columns.slug = 'aguardando-documentos'
)
update public.service_cards
set column_id = awaiting_columns.target_column_id,
    updated_at = now()
from awaiting_columns
where service_cards.column_id = awaiting_columns.source_column_id;

-- Mantem a coluna legada no banco para historico/FK, mas fora da ordem operacional.
update public.service_columns
set position = 999,
    updated_at = now()
where slug = 'aguardando-documentos';

create table if not exists public.user_ui_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  font_scale text not null default 'padrao',
  color_palette text not null default 'agrimensura_verde',
  dark_mode boolean not null default false,
  sidebar_collapsed boolean not null default false,
  time_widget_collapsed boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_page_visual_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_key text not null,
  background_type text not null default 'default',
  background_color text null,
  background_image_path text null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, page_key)
);

create table if not exists public.assistant_feedback_examples (
  id uuid primary key default gen_random_uuid(),
  original_prompt text null,
  correction_text text null,
  resolved_intent text null,
  approved_response_pattern text null,
  created_by uuid null references auth.users(id) on delete set null,
  organization_id uuid null references public.organizations(id) on delete set null,
  is_global_training boolean not null default true,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ui_preferences enable row level security;
alter table public.organization_page_visual_settings enable row level security;
alter table public.assistant_feedback_examples enable row level security;

drop policy if exists "user_ui_preferences_own_select" on public.user_ui_preferences;
create policy "user_ui_preferences_own_select"
  on public.user_ui_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "user_ui_preferences_own_write" on public.user_ui_preferences;
create policy "user_ui_preferences_own_write"
  on public.user_ui_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "organization_page_visual_settings_member_select" on public.organization_page_visual_settings;
create policy "organization_page_visual_settings_member_select"
  on public.organization_page_visual_settings for select
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "organization_page_visual_settings_owner_write" on public.organization_page_visual_settings;
create policy "organization_page_visual_settings_owner_write"
  on public.organization_page_visual_settings for all
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

drop policy if exists "assistant_feedback_examples_member_insert" on public.assistant_feedback_examples;
create policy "assistant_feedback_examples_member_insert"
  on public.assistant_feedback_examples for insert
  with check (
    organization_id is null
    or public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "assistant_feedback_examples_approved_select" on public.assistant_feedback_examples;
create policy "assistant_feedback_examples_approved_select"
  on public.assistant_feedback_examples for select
  using (status = 'approved' and is_global_training = true);

create index if not exists organization_page_visual_settings_org_page_idx
  on public.organization_page_visual_settings(organization_id, page_key);

create index if not exists assistant_feedback_examples_status_intent_idx
  on public.assistant_feedback_examples(status, resolved_intent);

notify pgrst, 'reload schema';
