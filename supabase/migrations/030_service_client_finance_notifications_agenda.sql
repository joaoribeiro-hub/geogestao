-- FASE SERVICE-CLIENT-FINANCE-NOTIFICATIONS-AGENDA-1
-- Refinos de servicos, financeiro por servico/cliente, notificacoes e agenda.
-- Execute primeiro no Supabase de teste.

alter table public.service_cards
  add column if not exists municipality text,
  add column if not exists responsible_user_id uuid references auth.users(id) on delete set null,
  add column if not exists payment_condition text,
  add column if not exists custom_service_name text;

alter table public.checklists
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists checklist_type text not null default 'steps'
    check (checklist_type in ('documents', 'steps'));

update public.checklists c
set organization_id = sc.organization_id
from public.service_cards sc
where c.service_card_id = sc.id
  and c.organization_id is null;

alter table public.checklist_items
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references auth.users(id) on delete set null;

update public.checklist_items
set completed_at = coalesce(completed_at, created_at)
where is_done = true
  and completed_at is null;

create table if not exists public.service_property_infos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_card_id uuid not null references public.service_cards(id) on delete cascade,
  title text not null,
  value text,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  dedupe_key text,
  scheduled_for timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, recipient_user_id, dedupe_key)
);

create table if not exists public.agenda_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  reminder_date date not null,
  reminder_time time,
  entity_type text,
  entity_id uuid,
  service_card_id uuid references public.service_cards(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_reminder_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reminder_id uuid not null references public.agenda_reminders(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reminder_id, recipient_user_id)
);

drop trigger if exists set_service_property_infos_updated_at on public.service_property_infos;
create trigger set_service_property_infos_updated_at
before update on public.service_property_infos
for each row execute function public.set_updated_at();

drop trigger if exists set_agenda_reminders_updated_at on public.agenda_reminders;
create trigger set_agenda_reminders_updated_at
before update on public.agenda_reminders
for each row execute function public.set_updated_at();

create index if not exists service_cards_org_responsible_idx
  on public.service_cards(organization_id, responsible_user_id);

create index if not exists checklists_service_type_idx
  on public.checklists(service_card_id, checklist_type);

create index if not exists service_property_infos_service_idx
  on public.service_property_infos(organization_id, service_card_id, position);

create index if not exists notifications_recipient_unread_idx
  on public.notifications(organization_id, recipient_user_id, created_at desc)
  where read_at is null;

create index if not exists agenda_reminders_org_date_idx
  on public.agenda_reminders(organization_id, reminder_date);

alter table public.service_property_infos enable row level security;
alter table public.notifications enable row level security;
alter table public.agenda_reminders enable row level security;
alter table public.agenda_reminder_recipients enable row level security;

drop policy if exists "service_property_infos_org_select" on public.service_property_infos;
create policy "service_property_infos_org_select"
  on public.service_property_infos for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "service_property_infos_org_insert" on public.service_property_infos;
create policy "service_property_infos_org_insert"
  on public.service_property_infos for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "service_property_infos_org_update" on public.service_property_infos;
create policy "service_property_infos_org_update"
  on public.service_property_infos for update
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "service_property_infos_org_delete" on public.service_property_infos;
create policy "service_property_infos_org_delete"
  on public.service_property_infos for delete
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "notifications_recipient_select" on public.notifications;
create policy "notifications_recipient_select"
  on public.notifications for select
  to authenticated
  using (
    recipient_user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "notifications_org_insert" on public.notifications;
create policy "notifications_org_insert"
  on public.notifications for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "notifications_recipient_update" on public.notifications;
create policy "notifications_recipient_update"
  on public.notifications for update
  to authenticated
  using (
    recipient_user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  )
  with check (
    recipient_user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "agenda_reminders_org_select" on public.agenda_reminders;
create policy "agenda_reminders_org_select"
  on public.agenda_reminders for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "agenda_reminders_org_insert" on public.agenda_reminders;
create policy "agenda_reminders_org_insert"
  on public.agenda_reminders for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "agenda_reminders_org_update" on public.agenda_reminders;
create policy "agenda_reminders_org_update"
  on public.agenda_reminders for update
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "agenda_reminders_org_delete" on public.agenda_reminders;
create policy "agenda_reminders_org_delete"
  on public.agenda_reminders for delete
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "agenda_recipients_org_select" on public.agenda_reminder_recipients;
create policy "agenda_recipients_org_select"
  on public.agenda_reminder_recipients for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "agenda_recipients_org_insert" on public.agenda_reminder_recipients;
create policy "agenda_recipients_org_insert"
  on public.agenda_reminder_recipients for insert
  to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "agenda_recipients_org_delete" on public.agenda_reminder_recipients;
create policy "agenda_recipients_org_delete"
  on public.agenda_reminder_recipients for delete
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

notify pgrst, 'reload schema';
