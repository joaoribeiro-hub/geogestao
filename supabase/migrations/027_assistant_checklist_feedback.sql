-- FASE AI-ASSISTANT-ACTIONS-CHECKLIST-1
-- Feedback supervisionado, checklist diario e activity log por organizacao.
-- Execute primeiro no Supabase de teste.

create table if not exists public.assistant_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  message_id uuid references public.assistant_messages(id) on delete set null,
  message_text text not null,
  assistant_response text not null,
  detected_intent text,
  detected_params jsonb not null default '{}',
  rating text not null check (rating in ('positive', 'negative')),
  correction_text text,
  corrected_intent text,
  corrected_params jsonb,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, checklist_date)
);

create table if not exists public.daily_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.daily_checklists(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_to uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'done', 'canceled')),
  is_emergency boolean not null default false,
  source text not null default 'self' check (source in ('self', 'owner_assignment', 'assistant')),
  related_service_id uuid references public.service_cards(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

drop trigger if exists set_daily_checklists_updated_at on public.daily_checklists;
create trigger set_daily_checklists_updated_at
before update on public.daily_checklists
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_checklist_items_updated_at on public.daily_checklist_items;
create trigger set_daily_checklist_items_updated_at
before update on public.daily_checklist_items
for each row execute function public.set_updated_at();

create index if not exists assistant_feedback_org_user_idx
  on public.assistant_feedback(organization_id, user_id, created_at desc);
create index if not exists daily_checklists_org_user_date_idx
  on public.daily_checklists(organization_id, user_id, checklist_date desc);
create index if not exists daily_checklist_items_org_assigned_idx
  on public.daily_checklist_items(organization_id, assigned_to, due_date, status);
create index if not exists organization_activity_log_org_actor_idx
  on public.organization_activity_log(organization_id, actor_user_id, occurred_at desc);
create index if not exists organization_activity_log_org_target_idx
  on public.organization_activity_log(organization_id, target_user_id, occurred_at desc);

alter table public.assistant_feedback enable row level security;
alter table public.daily_checklists enable row level security;
alter table public.daily_checklist_items enable row level security;
alter table public.organization_activity_log enable row level security;

drop policy if exists "assistant_feedback_org_select" on public.assistant_feedback;
create policy "assistant_feedback_org_select"
  on public.assistant_feedback for select
  to authenticated
  using (
    user_id = auth.uid()
    and organization_id is not null
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "assistant_feedback_org_insert" on public.assistant_feedback;
create policy "assistant_feedback_org_insert"
  on public.assistant_feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and organization_id is not null
    and public.is_org_member(organization_id, auth.uid())
  );

drop policy if exists "daily_checklists_org_select" on public.daily_checklists;
create policy "daily_checklists_org_select"
  on public.daily_checklists for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "daily_checklists_self_insert" on public.daily_checklists;
create policy "daily_checklists_self_insert"
  on public.daily_checklists for insert
  to authenticated
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "daily_checklists_self_or_owner_update" on public.daily_checklists;
create policy "daily_checklists_self_or_owner_update"
  on public.daily_checklists for update
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (user_id = auth.uid() or public.is_org_owner(organization_id, auth.uid()))
  )
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (user_id = auth.uid() or public.is_org_owner(organization_id, auth.uid()))
  );

drop policy if exists "daily_checklist_items_org_select" on public.daily_checklist_items;
create policy "daily_checklist_items_org_select"
  on public.daily_checklist_items for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "daily_checklist_items_self_or_owner_insert" on public.daily_checklist_items;
create policy "daily_checklist_items_self_or_owner_insert"
  on public.daily_checklist_items for insert
  to authenticated
  with check (
    public.is_org_member(organization_id, auth.uid())
    and created_by = auth.uid()
    and (
      assigned_to = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "daily_checklist_items_self_or_owner_update" on public.daily_checklist_items;
create policy "daily_checklist_items_self_or_owner_update"
  on public.daily_checklist_items for update
  to authenticated
  using (
    public.is_org_member(organization_id, auth.uid())
    and (
      assigned_to = auth.uid()
      or created_by = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  )
  with check (
    public.is_org_member(organization_id, auth.uid())
    and (
      assigned_to = auth.uid()
      or created_by = auth.uid()
      or public.is_org_owner(organization_id, auth.uid())
    )
  );

drop policy if exists "organization_activity_log_org_select" on public.organization_activity_log;
create policy "organization_activity_log_org_select"
  on public.organization_activity_log for select
  to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "organization_activity_log_actor_insert" on public.organization_activity_log;
create policy "organization_activity_log_actor_insert"
  on public.organization_activity_log for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );

insert into public.assistant_intents (name, description, category, examples, patterns, action_name, enabled)
values
  ('create_service', 'Cria servico tecnico apos confirmacao.', 'servicos', '["Crie um servico de georreferenciamento para o imovel Jucara com prazo de um mes e valor 1.200,50"]', '["criar servico", "cadastrar servico", "novo servico"]', 'createService', true),
  ('list_today_checklist', 'Lista checklist do usuario no dia.', 'checklist', '["O que eu programei para hoje?", "O que tenho no checklist hoje?"]', '["checklist hoje", "programei hoje"]', 'listTodayChecklist', true),
  ('create_checklist_item', 'Cria item no proprio checklist.', 'checklist', '["Criar item no checklist de hoje: ligar para o cliente"]', '["criar item checklist", "adicionar checklist"]', 'createChecklistItem', true),
  ('assign_checklist_item', 'Owner atribui item de checklist a membro.', 'checklist', '["Coloque para a Natalia revisar o contrato hoje"]', '["coloque para", "atribuir tarefa"]', 'assignChecklistItem', true),
  ('list_member_activity', 'Consulta atividades de membro da organizacao.', 'checklist', '["O que Joao esta fazendo agora?", "O que Natalia fez hoje?"]', '["esta fazendo agora", "fez hoje"]', 'listMemberActivity', true)
on conflict (name) do update
set description = excluded.description,
    category = excluded.category,
    examples = excluded.examples,
    patterns = excluded.patterns,
    action_name = excluded.action_name,
    enabled = excluded.enabled;

notify pgrst, 'reload schema';
