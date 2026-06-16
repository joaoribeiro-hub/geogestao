-- UI-SOPHIA-ROUTINE-TASKS-1
-- Ordem persistida de tarefas/rotina e mencoes em itens de rotina.

alter table public.daily_checklist_items
  add column if not exists sort_order integer not null default 0;

alter table public.routine_items
  add column if not exists sort_order integer not null default 0;

with ranked_daily as (
  select
    id,
    row_number() over (
      partition by organization_id, assigned_to, coalesce(due_date, created_at::date)
      order by is_emergency desc, created_at asc, id asc
    ) * 1000 as next_sort_order
  from public.daily_checklist_items
  where sort_order = 0
)
update public.daily_checklist_items d
set sort_order = ranked_daily.next_sort_order
from ranked_daily
where d.id = ranked_daily.id;

with ranked_routine as (
  select
    id,
    row_number() over (
      partition by organization_id, user_id, routine_scope, coalesce(routine_date, created_at::date)
      order by is_emergency desc, created_at asc, id asc
    ) * 1000 as next_sort_order
  from public.routine_items
  where sort_order = 0
)
update public.routine_items r
set sort_order = ranked_routine.next_sort_order
from ranked_routine
where r.id = ranked_routine.id;

create index if not exists daily_checklist_items_sort_order_idx
  on public.daily_checklist_items(organization_id, assigned_to, due_date, sort_order);

create index if not exists routine_items_sort_order_idx
  on public.routine_items(organization_id, user_id, routine_scope, routine_date, sort_order);

create table if not exists public.routine_item_mentions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  routine_item_id uuid not null references public.routine_items(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  mentioned_by uuid references public.profiles(id) on delete set null,
  mention_text text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, routine_item_id, mentioned_user_id)
);

create index if not exists routine_item_mentions_org_user_idx
  on public.routine_item_mentions(organization_id, mentioned_user_id, created_at desc);

create index if not exists routine_item_mentions_item_idx
  on public.routine_item_mentions(routine_item_id);

alter table public.routine_item_mentions enable row level security;

drop policy if exists "routine_item_mentions_select" on public.routine_item_mentions;
create policy "routine_item_mentions_select"
  on public.routine_item_mentions for select
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "routine_item_mentions_insert" on public.routine_item_mentions;
create policy "routine_item_mentions_insert"
  on public.routine_item_mentions for insert
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "routine_item_mentions_delete" on public.routine_item_mentions;
create policy "routine_item_mentions_delete"
  on public.routine_item_mentions for delete
  using (
    public.is_org_owner(organization_id, auth.uid())
    or mentioned_by = auth.uid()
  );

notify pgrst, 'reload schema';
