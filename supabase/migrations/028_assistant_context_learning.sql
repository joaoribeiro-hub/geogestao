-- FASE AI-ASSISTANT-CONTEXT-LEARNING-2
-- Memoria curta, feedback resolvido e exemplos globais sanitizados.
-- Execute primeiro no Supabase de teste.

alter table if exists public.assistant_feedback
  add column if not exists conversation_context jsonb not null default '{}',
  add column if not exists is_resolved boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

create table if not exists public.assistant_global_learning_examples (
  id uuid primary key default gen_random_uuid(),
  promoted_from_feedback_id uuid references public.assistant_feedback(id) on delete set null,
  original_sanitized text not null,
  correction_sanitized text not null,
  corrected_intent text,
  params_schema jsonb not null default '{}',
  source text not null default 'feedback_sanitized',
  is_sanitized boolean not null default true,
  privacy_level text not null default 'global_sanitized' check (privacy_level = 'global_sanitized'),
  needs_review boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_assistant_global_learning_examples_updated_at on public.assistant_global_learning_examples;
create trigger set_assistant_global_learning_examples_updated_at
before update on public.assistant_global_learning_examples
for each row execute function public.set_updated_at();

create index if not exists assistant_global_learning_examples_active_idx
  on public.assistant_global_learning_examples(is_active, created_at desc);

create index if not exists assistant_global_learning_examples_intent_idx
  on public.assistant_global_learning_examples(corrected_intent, is_active);

alter table public.assistant_global_learning_examples enable row level security;

drop policy if exists "assistant_global_learning_select_sanitized" on public.assistant_global_learning_examples;
create policy "assistant_global_learning_select_sanitized"
  on public.assistant_global_learning_examples for select
  to authenticated
  using (
    is_active = true
    and is_sanitized = true
    and privacy_level = 'global_sanitized'
  );

drop policy if exists "assistant_global_learning_insert_sanitized" on public.assistant_global_learning_examples;
create policy "assistant_global_learning_insert_sanitized"
  on public.assistant_global_learning_examples for insert
  to authenticated
  with check (
    is_sanitized = true
    and privacy_level = 'global_sanitized'
    and source = 'feedback_sanitized'
  );

insert into public.assistant_intents (name, description, category, examples, patterns, action_name, enabled)
values
  ('list_member_checklist', 'Consulta checklist diario de um membro da organizacao.', 'checklist', '["O que o funcionario Joao programou para hoje?"]', '["funcionario programou", "checklist do membro"]', 'listMemberActivity', true),
  ('list_member_current_status', 'Consulta itens concluidos e provavel atividade atual de um membro.', 'checklist', '["Qual tarefa Joao ja concluiu e o que ele esta fazendo agora?"]', '["ele ja concluiu", "fazendo agora"]', 'listMemberActivity', true)
on conflict (name) do update
set description = excluded.description,
    category = excluded.category,
    examples = excluded.examples,
    patterns = excluded.patterns,
    action_name = excluded.action_name,
    enabled = excluded.enabled;

notify pgrst, 'reload schema';
