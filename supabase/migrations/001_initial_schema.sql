create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'leitura'
    check (role in ('admin', 'gerente', 'tecnico', 'financeiro', 'leitura')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'pf' check (kind in ('pf', 'pj')),
  name text not null,
  document text,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('ligacao', 'email', 'reuniao', 'whatsapp', 'nota')),
  occurred_at timestamptz not null default now(),
  responsible_id uuid references public.profiles(id) on delete set null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null,
  description text,
  value numeric(14,2),
  owner_id uuid references public.profiles(id) on delete set null,
  sent_at date,
  valid_until date,
  comments text,
  stage text not null default 'todo'
    check (stage in ('todo', 'sent', 'negotiation', 'execution', 'finished', 'lost')),
  position integer not null default 0,
  converted_service_card_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.service_boards(id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, slug)
);

create table if not exists public.service_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.service_columns(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  checklist_percent numeric(5,2) not null default 0,
  custom_fields_json jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_from_proposal_id uuid references public.proposals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proposals
  add constraint proposals_converted_service_card_id_fkey
  foreign key (converted_service_card_id)
  references public.service_cards(id)
  on delete set null;

create table if not exists public.service_card_movements (
  id uuid primary key default gen_random_uuid(),
  service_card_id uuid not null references public.service_cards(id) on delete cascade,
  from_column_id uuid references public.service_columns(id) on delete set null,
  to_column_id uuid not null references public.service_columns(id) on delete restrict,
  moved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  service_card_id uuid not null references public.service_cards(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in (
      'client',
      'proposal',
      'service_card',
      'revenue',
      'expense',
      'document_template',
      'legislation_item'
    )
  ),
  entity_id uuid not null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.revenues (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  proposal_id uuid references public.proposals(id) on delete set null,
  service_card_id uuid references public.service_cards(id) on delete set null,
  description text not null,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date not null,
  paid_at date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  service_card_id uuid references public.service_cards(id) on delete set null,
  description text not null,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date not null,
  paid_at date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  version text not null,
  status text not null default 'vigente' check (status in ('vigente', 'obsoleto')),
  description text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legislation_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  official_link text,
  technical_summary text,
  practical_points text,
  status text not null default 'vigente' check (status in ('vigente', 'revogado', 'atencao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clients_name_idx on public.clients using gin (to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(document, '') || ' ' || coalesce(email, '')));
create index if not exists client_interactions_client_id_idx on public.client_interactions(client_id);
create index if not exists proposals_stage_position_idx on public.proposals(stage, position);
create index if not exists proposals_client_id_idx on public.proposals(client_id);
create index if not exists service_columns_board_id_idx on public.service_columns(board_id, position);
create index if not exists service_cards_column_id_idx on public.service_cards(column_id, position);
create index if not exists service_cards_due_date_idx on public.service_cards(due_date);
create index if not exists attachments_entity_idx on public.attachments(entity_type, entity_id);
create index if not exists revenues_due_status_idx on public.revenues(due_date, status);
create index if not exists expenses_due_status_idx on public.expenses(due_date, status);
create index if not exists documents_search_idx on public.document_templates using gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')));
create index if not exists legislation_search_idx on public.legislation_items using gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(technical_summary, '') || ' ' || coalesce(practical_points, '')));

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_proposals_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();

create trigger set_service_boards_updated_at
before update on public.service_boards
for each row execute function public.set_updated_at();

create trigger set_service_columns_updated_at
before update on public.service_columns
for each row execute function public.set_updated_at();

create trigger set_service_cards_updated_at
before update on public.service_cards
for each row execute function public.set_updated_at();

create trigger set_revenues_updated_at
before update on public.revenues
for each row execute function public.set_updated_at();

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create trigger set_document_templates_updated_at
before update on public.document_templates
for each row execute function public.set_updated_at();

create trigger set_legislation_items_updated_at
before update on public.legislation_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'leitura')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_interactions enable row level security;
alter table public.proposals enable row level security;
alter table public.service_boards enable row level security;
alter table public.service_columns enable row level security;
alter table public.service_cards enable row level security;
alter table public.service_card_movements enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.attachments enable row level security;
alter table public.revenues enable row level security;
alter table public.expenses enable row level security;
alter table public.document_templates enable row level security;
alter table public.legislation_items enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_authenticated" on public.profiles
for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "clients_crud_authenticated" on public.clients
for all to authenticated using (true) with check (true);

create policy "client_interactions_crud_authenticated" on public.client_interactions
for all to authenticated using (true) with check (true);

create policy "proposals_crud_authenticated" on public.proposals
for all to authenticated using (true) with check (true);

create policy "service_boards_crud_authenticated" on public.service_boards
for all to authenticated using (true) with check (true);

create policy "service_columns_crud_authenticated" on public.service_columns
for all to authenticated using (true) with check (true);

create policy "service_cards_crud_authenticated" on public.service_cards
for all to authenticated using (true) with check (true);

create policy "service_card_movements_crud_authenticated" on public.service_card_movements
for all to authenticated using (true) with check (true);

create policy "checklists_crud_authenticated" on public.checklists
for all to authenticated using (true) with check (true);

create policy "checklist_items_crud_authenticated" on public.checklist_items
for all to authenticated using (true) with check (true);

create policy "attachments_crud_authenticated" on public.attachments
for all to authenticated using (true) with check (true);

create policy "revenues_crud_authenticated" on public.revenues
for all to authenticated using (true) with check (true);

create policy "expenses_crud_authenticated" on public.expenses
for all to authenticated using (true) with check (true);

create policy "document_templates_crud_authenticated" on public.document_templates
for all to authenticated using (true) with check (true);

create policy "legislation_items_crud_authenticated" on public.legislation_items
for all to authenticated using (true) with check (true);

create policy "audit_logs_select_authenticated" on public.audit_logs
for select to authenticated using (true);

create policy "audit_logs_insert_authenticated" on public.audit_logs
for insert to authenticated with check (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

create policy "storage_attachments_select_authenticated" on storage.objects
for select to authenticated using (bucket_id = 'attachments');

create policy "storage_attachments_insert_authenticated" on storage.objects
for insert to authenticated with check (bucket_id = 'attachments');

create policy "storage_attachments_update_authenticated" on storage.objects
for update to authenticated using (bucket_id = 'attachments') with check (bucket_id = 'attachments');

create policy "storage_attachments_delete_authenticated" on storage.objects
for delete to authenticated using (bucket_id = 'attachments');
