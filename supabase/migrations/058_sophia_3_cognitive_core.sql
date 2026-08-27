-- Sophia 3.0: core cognitivo incremental, FTS documental, reflexoes e skills.
-- Depende das migrations 054 e 057. Nao habilita pgvector automaticamente.

alter table if exists public.sophia_memories
  add column if not exists memory_type text not null default 'semantic';

alter table if exists public.sophia_memories
  drop constraint if exists sophia_memories_memory_type_check;

alter table if exists public.sophia_memories
  add constraint sophia_memories_memory_type_check
  check (memory_type in ('semantic', 'episodic', 'procedural', 'operational'));

alter table if exists public.document_chunks
  add column if not exists content_tsv tsvector;

update public.document_chunks
set content_tsv = to_tsvector('simple', coalesce(content, text, ''))
where content_tsv is null;

create or replace function public.refresh_sophia_document_chunk_tsv()
returns trigger
language plpgsql
as $$
begin
  new.content_tsv := to_tsvector('simple', coalesce(new.content, new.text, ''));
  return new;
end;
$$;

drop trigger if exists refresh_sophia_document_chunk_tsv on public.document_chunks;
create trigger refresh_sophia_document_chunk_tsv
before insert or update of content, text on public.document_chunks
for each row execute function public.refresh_sophia_document_chunk_tsv();

create index if not exists document_chunks_content_tsv_idx
  on public.document_chunks using gin(content_tsv);

create table if not exists public.sophia_document_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  inbox_item_id uuid references public.sophia_inbox_items(id) on delete cascade,
  storage_bucket text not null default 'documentos',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'canceled')),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  extractor text,
  ocr_used boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists sophia_document_ingestion_jobs_inbox_uidx
  on public.sophia_document_ingestion_jobs(inbox_item_id)
  where inbox_item_id is not null and status not in ('completed', 'failed', 'canceled');

create index if not exists sophia_document_ingestion_jobs_org_idx
  on public.sophia_document_ingestion_jobs(organization_id, created_at desc);

create table if not exists public.sophia_document_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  ingestion_job_id uuid references public.sophia_document_ingestion_jobs(id) on delete cascade,
  entity_type text not null,
  entity_value text not null,
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sophia_document_entities_org_doc_idx
  on public.sophia_document_entities(organization_id, document_id);

create table if not exists public.sophia_reflections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  run_id uuid references public.sophia_runs(id) on delete set null,
  message_id uuid references public.assistant_messages(id) on delete set null,
  scope text not null default 'user'
    check (scope in ('user', 'organization', 'global_candidate')),
  source_type text not null default 'feedback',
  source_id uuid,
  failed_intent text,
  original_answer text not null,
  user_feedback text not null,
  corrected_answer text,
  possible_fix text,
  reflection text not null,
  status text not null default 'active'
    check (status in ('active', 'archived', 'promoted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists sophia_reflections_org_intent_idx
  on public.sophia_reflections(organization_id, failed_intent, created_at desc);

create table if not exists public.sophia_skills (
  id uuid primary key default gen_random_uuid(),
  skill_key text unique not null,
  name text not null,
  description text not null,
  risk_level text not null default 'read'
    check (risk_level in ('read', 'internal_write', 'external_write', 'destructive')),
  requires_confirmation boolean not null default false,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sophia_skill_examples (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.sophia_skills(id) on delete cascade,
  example_text text not null,
  intent text,
  expected_tool text,
  created_at timestamptz not null default now()
);

create table if not exists public.sophia_eval_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  input_text text not null,
  expected_behavior text not null,
  expected_tool text,
  scope text not null default 'organization'
    check (scope in ('organization', 'global')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sophia_eval_runs (
  id uuid primary key default gen_random_uuid(),
  eval_case_id uuid not null references public.sophia_eval_cases(id) on delete cascade,
  status text not null default 'pending',
  result jsonb not null default '{}'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);

insert into public.sophia_skills (skill_key, name, description, risk_level, requires_confirmation, config)
values
  ('responder_atividade_membro', 'Responder atividade de membro', 'Consulta checklist, rotina e atividade recente de um membro.', 'read', false, '{"tools":["tasks.list_pending","checklist.today"]}'::jsonb),
  ('concluir_etapa_servico', 'Concluir etapa de servico', 'Localiza e conclui uma etapa do servico informado.', 'internal_write', true, '{"tools":["service_steps.complete"]}'::jsonb),
  ('alterar_data_servico', 'Alterar data prevista de servico', 'Atualiza a data prevista de um servico existente.', 'internal_write', true, '{"tools":["services.update_due_date"]}'::jsonb),
  ('resumir_cliente', 'Resumir cliente', 'Monta um resumo operacional de um cliente.', 'read', false, '{"tools":["clients.summarize"]}'::jsonb),
  ('buscar_documento', 'Buscar documento', 'Busca documentos e trechos dentro da organizacao atual.', 'read', false, '{"tools":["documents.search","document_search"]}'::jsonb),
  ('analisar_documento', 'Analisar documento', 'Responde perguntas com evidencia documental citavel.', 'read', false, '{"tools":["document_answer","document_summarize"]}'::jsonb),
  ('criar_tarefa', 'Criar tarefa', 'Cria uma tarefa operacional para o usuario ou membro permitido.', 'internal_write', true, '{"tools":["tasks.create_checklist_item","clients.create_task"]}'::jsonb),
  ('criar_lembrete', 'Criar lembrete', 'Cria lembrete interno respeitando destinatarios da organizacao.', 'internal_write', true, '{"tools":["clients.create_interaction"]}'::jsonb),
  ('consultar_buscageo', 'Consultar jobs BuscaGEO', 'Consulta jobs do modulo BuscaGEO.', 'read', false, '{"tools":["geo.buscageo_jobs.list"]}'::jsonb),
  ('consultar_analise_ambiental', 'Consultar jobs de analise ambiental', 'Consulta jobs da analise ambiental.', 'read', false, '{"tools":["geo.environmental_jobs.list"]}'::jsonb)
on conflict (skill_key) do update set
  name = excluded.name,
  description = excluded.description,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  config = excluded.config,
  updated_at = now();

alter table public.sophia_document_ingestion_jobs enable row level security;
alter table public.sophia_document_entities enable row level security;
alter table public.sophia_reflections enable row level security;
alter table public.sophia_skills enable row level security;
alter table public.sophia_skill_examples enable row level security;
alter table public.sophia_eval_cases enable row level security;
alter table public.sophia_eval_runs enable row level security;

drop policy if exists "sophia_ingestion_member_select" on public.sophia_document_ingestion_jobs;
create policy "sophia_ingestion_member_select" on public.sophia_document_ingestion_jobs for select using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_document_ingestion_jobs.organization_id and om.user_id = auth.uid() and om.status = 'active')
);
drop policy if exists "sophia_ingestion_member_insert" on public.sophia_document_ingestion_jobs;
create policy "sophia_ingestion_member_insert" on public.sophia_document_ingestion_jobs for insert with check (
  user_id = auth.uid() and exists (select 1 from public.organization_members om where om.organization_id = sophia_document_ingestion_jobs.organization_id and om.user_id = auth.uid() and om.status = 'active')
);
drop policy if exists "sophia_ingestion_member_update" on public.sophia_document_ingestion_jobs;
create policy "sophia_ingestion_member_update" on public.sophia_document_ingestion_jobs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sophia_entities_member_access" on public.sophia_document_entities;
create policy "sophia_entities_member_access" on public.sophia_document_entities for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_document_entities.organization_id and om.user_id = auth.uid() and om.status = 'active')
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_document_entities.organization_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists "sophia_reflections_member_select" on public.sophia_reflections;
create policy "sophia_reflections_member_select" on public.sophia_reflections for select using (
  user_id = auth.uid() or exists (select 1 from public.organization_members om where om.organization_id = sophia_reflections.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner')
);
drop policy if exists "sophia_reflections_member_insert" on public.sophia_reflections;
create policy "sophia_reflections_member_insert" on public.sophia_reflections for insert with check (
  user_id = auth.uid() and exists (select 1 from public.organization_members om where om.organization_id = sophia_reflections.organization_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists "sophia_skills_member_select" on public.sophia_skills;
create policy "sophia_skills_member_select" on public.sophia_skills for select using (auth.uid() is not null);
drop policy if exists "sophia_skill_examples_member_select" on public.sophia_skill_examples;
create policy "sophia_skill_examples_member_select" on public.sophia_skill_examples for select using (auth.uid() is not null);

drop policy if exists "sophia_eval_cases_owner_access" on public.sophia_eval_cases;
create policy "sophia_eval_cases_owner_access" on public.sophia_eval_cases for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_eval_cases.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner')
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_eval_cases.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner')
);
drop policy if exists "sophia_eval_runs_owner_access" on public.sophia_eval_runs;
create policy "sophia_eval_runs_owner_access" on public.sophia_eval_runs for all using (
  exists (select 1 from public.sophia_eval_cases ec join public.organization_members om on om.organization_id = ec.organization_id where ec.id = sophia_eval_runs.eval_case_id and om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner')
);

-- O catalogo de skills e as reflexoes sao preenchidos pelo backend; o owner revisa candidatos.
drop policy if exists "sophia_rule_candidates_member_insert" on public.sophia_rule_candidates;
create policy "sophia_rule_candidates_member_insert" on public.sophia_rule_candidates for insert with check (
  created_by = auth.uid() and exists (select 1 from public.organization_members om where om.organization_id = sophia_rule_candidates.organization_id and om.user_id = auth.uid() and om.status = 'active')
);

create or replace function public.capture_sophia_activity_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sophia_events (organization_id, user_id, event_type, entity_type, entity_id, payload, status)
  values (new.organization_id, new.actor_user_id, new.activity_type, new.entity_type, new.entity_id, jsonb_build_object('metadata', new.metadata, 'target_user_id', new.target_user_id), 'pending');
  return new;
end;
$$;

drop trigger if exists capture_sophia_activity_event on public.organization_activity_log;
create trigger capture_sophia_activity_event
after insert on public.organization_activity_log
for each row execute function public.capture_sophia_activity_event();

