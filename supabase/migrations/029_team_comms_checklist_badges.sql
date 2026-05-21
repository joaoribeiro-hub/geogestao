-- FASE TEAM-COMMS-CHECKLIST-BADGES-1
-- Chat da equipe por organizacao e apoio a badges flutuantes.
-- Execute primeiro no Supabase de teste.

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 1000),
  message_type text not null default 'text' check (message_type in ('text')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.team_chat_reads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

drop trigger if exists set_team_chat_messages_updated_at on public.team_chat_messages;
create trigger set_team_chat_messages_updated_at
before update on public.team_chat_messages
for each row execute function public.set_updated_at();

drop trigger if exists set_team_chat_reads_updated_at on public.team_chat_reads;
create trigger set_team_chat_reads_updated_at
before update on public.team_chat_reads
for each row execute function public.set_updated_at();

create index if not exists team_chat_messages_org_created_idx
  on public.team_chat_messages(organization_id, created_at desc)
  where deleted_at is null;

create index if not exists team_chat_messages_org_sender_idx
  on public.team_chat_messages(organization_id, sender_user_id, created_at desc)
  where deleted_at is null;

create index if not exists team_chat_reads_org_user_idx
  on public.team_chat_reads(organization_id, user_id);

alter table public.team_chat_messages enable row level security;
alter table public.team_chat_reads enable row level security;

drop policy if exists "team_chat_messages_select_org" on public.team_chat_messages;
create policy "team_chat_messages_select_org"
  on public.team_chat_messages for select
  to authenticated
  using (
    deleted_at is null
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "team_chat_messages_insert_org" on public.team_chat_messages;
create policy "team_chat_messages_insert_org"
  on public.team_chat_messages for insert
  to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "team_chat_messages_soft_delete_sender_owner" on public.team_chat_messages;
create policy "team_chat_messages_soft_delete_sender_owner"
  on public.team_chat_messages for update
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (
      sender_user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  )
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (
      sender_user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "team_chat_reads_select_self" on public.team_chat_reads;
create policy "team_chat_reads_select_self"
  on public.team_chat_reads for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "team_chat_reads_insert_self" on public.team_chat_reads;
create policy "team_chat_reads_insert_self"
  on public.team_chat_reads for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "team_chat_reads_update_self" on public.team_chat_reads;
create policy "team_chat_reads_update_self"
  on public.team_chat_reads for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'team_chat_messages'
    )
  then
    alter publication supabase_realtime add table public.team_chat_messages;
  end if;
end $$;

notify pgrst, 'reload schema';
