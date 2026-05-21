-- FASE ASSISTANT-1 - Assistente IA por intencoes, historico e action logs.
-- Execute primeiro no Supabase de teste.

create or replace function public.assistant_is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

grant execute on function public.assistant_is_org_member(uuid) to authenticated;

create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_intents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  examples jsonb not null default '[]',
  patterns jsonb not null default '[]',
  action_name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_action_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  message_id uuid references public.assistant_messages(id) on delete set null,
  action_name text not null,
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  status text not null check (status in ('ok', 'needs_confirmation', 'error')),
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  service_card_id uuid references public.service_cards(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'done', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_assistant_conversations_updated_at on public.assistant_conversations;
create trigger set_assistant_conversations_updated_at
before update on public.assistant_conversations
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_tasks_updated_at on public.assistant_tasks;
create trigger set_assistant_tasks_updated_at
before update on public.assistant_tasks
for each row execute function public.set_updated_at();

create index if not exists assistant_conversations_user_idx
  on public.assistant_conversations(organization_id, user_id, updated_at desc);
create index if not exists assistant_messages_conversation_idx
  on public.assistant_messages(conversation_id, created_at);
create index if not exists assistant_action_logs_user_idx
  on public.assistant_action_logs(organization_id, user_id, created_at desc);
create index if not exists assistant_tasks_org_status_idx
  on public.assistant_tasks(organization_id, status, due_date);
create index if not exists assistant_tasks_client_idx
  on public.assistant_tasks(client_id)
  where client_id is not null;

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_intents enable row level security;
alter table public.assistant_action_logs enable row level security;
alter table public.assistant_tasks enable row level security;

drop policy if exists "assistant_conversations_owner_select" on public.assistant_conversations;
create policy "assistant_conversations_owner_select"
  on public.assistant_conversations for select
  to authenticated
  using (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_conversations_owner_insert" on public.assistant_conversations;
create policy "assistant_conversations_owner_insert"
  on public.assistant_conversations for insert
  to authenticated
  with check (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_conversations_owner_update" on public.assistant_conversations;
create policy "assistant_conversations_owner_update"
  on public.assistant_conversations for update
  to authenticated
  using (user_id = auth.uid() and public.assistant_is_org_member(organization_id))
  with check (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_messages_owner_select" on public.assistant_messages;
create policy "assistant_messages_owner_select"
  on public.assistant_messages for select
  to authenticated
  using (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_messages_owner_insert" on public.assistant_messages;
create policy "assistant_messages_owner_insert"
  on public.assistant_messages for insert
  to authenticated
  with check (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_intents_select_authenticated" on public.assistant_intents;
create policy "assistant_intents_select_authenticated"
  on public.assistant_intents for select
  to authenticated
  using (enabled = true);

drop policy if exists "assistant_action_logs_owner_select" on public.assistant_action_logs;
create policy "assistant_action_logs_owner_select"
  on public.assistant_action_logs for select
  to authenticated
  using (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_action_logs_owner_insert" on public.assistant_action_logs;
create policy "assistant_action_logs_owner_insert"
  on public.assistant_action_logs for insert
  to authenticated
  with check (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_tasks_org_select" on public.assistant_tasks;
create policy "assistant_tasks_org_select"
  on public.assistant_tasks for select
  to authenticated
  using (public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_tasks_org_insert" on public.assistant_tasks;
create policy "assistant_tasks_org_insert"
  on public.assistant_tasks for insert
  to authenticated
  with check (user_id = auth.uid() and public.assistant_is_org_member(organization_id));

drop policy if exists "assistant_tasks_org_update" on public.assistant_tasks;
create policy "assistant_tasks_org_update"
  on public.assistant_tasks for update
  to authenticated
  using (public.assistant_is_org_member(organization_id))
  with check (public.assistant_is_org_member(organization_id));

insert into public.assistant_intents (name, description, examples, patterns, action_name, enabled)
values
  ('list_today_services', 'Lista servicos do dia atual.', '["Quais os servicos para hoje?", "O que tenho para hoje?"]', '["servicos hoje", "para hoje"]', 'listTodayServices', true),
  ('list_month_services', 'Lista servicos do mes atual.', '["Quais servicos tenho esse mes?"]', '["servicos este mes", "servicos esse mes"]', 'listMonthServices', true),
  ('list_overdue_services', 'Lista servicos atrasados.', '["Quais servicos estao atrasados?"]', '["servicos atrasados", "vencidos"]', 'listOverdueServices', true),
  ('list_pending_tasks', 'Lista tarefas pendentes do assistente e checklists.', '["Quais tarefas pendentes?", "O que tenho para fazer hoje?"]', '["tarefas pendentes", "para fazer"]', 'listPendingTasks', true),
  ('summarize_client', 'Resume dados de um cliente.', '["Resumo do cliente Ramon"]', '["resumo do cliente"]', 'summarizeClient', true),
  ('create_client_task', 'Cria tarefa interna vinculada a cliente.', '["Criar uma tarefa: convidar o cliente para reuniao para o cliente Ramon"]', '["criar tarefa", "nova tarefa"]', 'createClientTask', true),
  ('create_client_interaction', 'Registra interacao no cliente.', '["Criar uma interacao no cliente Ramon dizendo que ele pediu retorno amanha"]', '["criar interacao", "registrar interacao"]', 'createClientInteraction', true),
  ('list_client_services', 'Lista servicos de um cliente.', '["Mostre os servicos do cliente Ramon"]', '["servicos do cliente"]', 'listClientServices', true),
  ('list_client_commercial_records', 'Lista propostas e contratos de um cliente.', '["Quais propostas e contratos existem para esse cliente?"]', '["propostas contratos cliente"]', 'listClientCommercialRecords', true)
on conflict (name) do update
set description = excluded.description,
    examples = excluded.examples,
    patterns = excluded.patterns,
    action_name = excluded.action_name,
    enabled = excluded.enabled;

notify pgrst, 'reload schema';
