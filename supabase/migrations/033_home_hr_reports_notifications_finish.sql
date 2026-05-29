-- FASE HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1
-- Finalizacao de notificacoes do Inicio, Relatorios, Base Interna e RH.
-- Execute primeiro no Supabase de teste.

create extension if not exists pgcrypto;

alter table public.team_members
  add column if not exists birth_date date;

alter table public.daily_checklist_items
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.routine_items
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.checklist_items
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.hr_documents
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;

create table if not exists public.company_knowledge_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_item_id uuid not null references public.company_knowledge_items(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  due_date date,
  due_time time,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz
);

create index if not exists daily_checklist_items_report_idx
  on public.daily_checklist_items(organization_id, assigned_to, status, due_date, created_at);

create index if not exists routine_items_report_idx
  on public.routine_items(organization_id, user_id, status, routine_date, created_at);

create index if not exists checklist_items_report_idx
  on public.checklist_items(checklist_id, is_done, due_date, created_at);

create index if not exists company_knowledge_checklist_items_org_idx
  on public.company_knowledge_checklist_items(organization_id, knowledge_item_id);

alter table public.company_knowledge_checklist_items enable row level security;

drop policy if exists "company_knowledge_checklist_select" on public.company_knowledge_checklist_items;
create policy "company_knowledge_checklist_select"
  on public.company_knowledge_checklist_items for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "company_knowledge_checklist_mutate" on public.company_knowledge_checklist_items;
create policy "company_knowledge_checklist_mutate"
  on public.company_knowledge_checklist_items for all
  to authenticated
  using (public.is_org_owner(organization_id, auth.uid()))
  with check (public.is_org_owner(organization_id, auth.uid()));

notify pgrst, 'reload schema';
