-- FASE NOTIFICATIONS-CHAT-AGENDA-REFINE-1
-- Links internos de notificacao e chat geral/direto por conversa.

alter table public.notifications
  add column if not exists action_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.notifications
  drop constraint if exists notifications_action_url_internal_chk;

alter table public.notifications
  add constraint notifications_action_url_internal_chk
  check (
    action_url is null
    or (
      action_url ~ '^/[A-Za-z0-9_/?=&.#%-]*$'
      and action_url !~ '^//'
    )
  );

alter table public.team_chat_messages
  add column if not exists chat_scope text not null default 'general',
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists conversation_key text not null default 'general';

alter table public.team_chat_messages
  drop constraint if exists team_chat_messages_chat_scope_chk;

alter table public.team_chat_messages
  add constraint team_chat_messages_chat_scope_chk
  check (chat_scope in ('general', 'direct'));

update public.team_chat_messages
set chat_scope = 'general',
    conversation_key = 'general'
where chat_scope is null
   or conversation_key is null
   or conversation_key = '';

alter table public.team_chat_reads
  add column if not exists conversation_key text not null default 'general';

alter table public.team_chat_reads
  drop constraint if exists team_chat_reads_organization_id_user_id_key;

alter table public.team_chat_reads
  drop constraint if exists team_chat_reads_org_user_conversation_key;

alter table public.team_chat_reads
  add constraint team_chat_reads_org_user_conversation_key
  unique (organization_id, user_id, conversation_key);

create index if not exists team_chat_messages_conversation_created_idx
  on public.team_chat_messages(organization_id, conversation_key, created_at desc)
  where deleted_at is null;

create index if not exists team_chat_messages_direct_recipient_idx
  on public.team_chat_messages(organization_id, recipient_user_id, created_at desc)
  where deleted_at is null and chat_scope = 'direct';

drop policy if exists "team_chat_messages_select_org" on public.team_chat_messages;
create policy "team_chat_messages_select_org"
  on public.team_chat_messages for select
  to authenticated
  using (
    deleted_at is null
    and public.is_org_member(organization_id, auth.uid())
    and (
      chat_scope = 'general'
      or sender_user_id = auth.uid()
      or recipient_user_id = auth.uid()
    )
  );

drop policy if exists "team_chat_messages_insert_org" on public.team_chat_messages;
create policy "team_chat_messages_insert_org"
  on public.team_chat_messages for insert
  to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
    and (
      (chat_scope = 'general' and recipient_user_id is null and conversation_key = 'general')
      or (
        chat_scope = 'direct'
        and recipient_user_id is not null
        and recipient_user_id <> auth.uid()
        and public.is_org_member(organization_id, recipient_user_id)
        and conversation_key = (
          'direct:'
          || least(auth.uid()::text, recipient_user_id::text)
          || ':'
          || greatest(auth.uid()::text, recipient_user_id::text)
        )
      )
    )
  );

drop policy if exists "team_chat_messages_soft_delete_sender_owner" on public.team_chat_messages;
create policy "team_chat_messages_soft_delete_sender_owner"
  on public.team_chat_messages for update
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (
      sender_user_id = auth.uid()
      or (chat_scope = 'general' and public.is_org_owner(organization_id, auth.uid()))
    )
  )
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (
      sender_user_id = auth.uid()
      or (chat_scope = 'general' and public.is_org_owner(organization_id, auth.uid()))
    )
  );

notify pgrst, 'reload schema';
