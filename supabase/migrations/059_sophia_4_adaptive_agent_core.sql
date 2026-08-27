-- Sophia 4.0: runtime em grafo, execucao de skills, verificacao e aprendizado revisavel.
-- Incremental sobre 054, 057 e 058. Nao instala modelos ou extensoes externas.

alter table if exists public.sophia_memories
  drop constraint if exists sophia_memories_memory_type_check;

alter table if exists public.sophia_memories
  add constraint sophia_memories_memory_type_check
  check (memory_type in (
    'semantic', 'episodic', 'procedural', 'operational',
    'reflection', 'preference', 'organization_rule'
  ));

alter table if exists public.sophia_memories
  drop constraint if exists sophia_memories_scope_check;

alter table if exists public.sophia_memories
  add constraint sophia_memories_scope_check
  check (scope in (
    'conversation', 'user', 'project', 'service', 'client', 'company', 'document',
    'organization', 'global_template'
  ));

alter table if exists public.sophia_tool_calls
  add column if not exists lifecycle_status text not null default 'requested';

alter table if exists public.sophia_tool_calls
  drop constraint if exists sophia_tool_calls_lifecycle_status_check;

alter table if exists public.sophia_tool_calls
  add constraint sophia_tool_calls_lifecycle_status_check
  check (lifecycle_status in ('requested', 'executed', 'verified', 'failed'));

create table if not exists public.sophia_skill_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.sophia_runs(id) on delete cascade,
  skill_key text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'needs_confirmation', 'completed', 'succeeded', 'failed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists sophia_skill_runs_org_created_idx
  on public.sophia_skill_runs(organization_id, created_at desc);
create index if not exists sophia_skill_runs_run_idx
  on public.sophia_skill_runs(run_id);

create table if not exists public.sophia_graph_traces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.sophia_runs(id) on delete cascade,
  node_key text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  status text not null default 'completed'
    check (status in ('started', 'completed', 'skipped', 'failed')),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists sophia_graph_traces_run_created_idx
  on public.sophia_graph_traces(run_id, created_at);
create index if not exists sophia_graph_traces_org_created_idx
  on public.sophia_graph_traces(organization_id, created_at desc);

create table if not exists public.sophia_memory_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  memory_id uuid not null references public.sophia_memories(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create index if not exists sophia_memory_links_memory_idx
  on public.sophia_memory_links(memory_id);
create index if not exists sophia_memory_links_org_source_idx
  on public.sophia_memory_links(organization_id, source_type, source_id);

create table if not exists public.sophia_rule_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_candidate_id uuid not null references public.sophia_rule_candidates(id) on delete cascade,
  approved_by uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, rule_candidate_id)
);

create index if not exists sophia_rule_approvals_org_created_idx
  on public.sophia_rule_approvals(organization_id, created_at desc);

alter table if exists public.sophia_eval_cases
  add column if not exists eval_key text,
  add column if not exists expected_skill text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.sophia_eval_runs
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists run_id uuid references public.sophia_runs(id) on delete set null,
  add column if not exists finished_at timestamptz;

update public.sophia_eval_runs er
set organization_id = ec.organization_id
from public.sophia_eval_cases ec
where er.eval_case_id = ec.id
  and er.organization_id is null;

create unique index if not exists sophia_eval_cases_org_key_uidx
  on public.sophia_eval_cases(organization_id, eval_key)
  where eval_key is not null;
create index if not exists sophia_eval_runs_org_created_idx
  on public.sophia_eval_runs(organization_id, created_at desc);

insert into public.sophia_skills (skill_key, name, description, risk_level, requires_confirmation, config)
values
  ('consultar_trabalho_atual_membro', 'Consultar trabalho atual de membro', 'Consulta checklist e atividade recente de um membro.', 'read', false, '{"tools":["members.current_activity"],"agent":"routine"}'::jsonb),
  ('concluir_etapa_servico', 'Concluir etapa de servico', 'Conclui etapa real com confirmacao e verificacao.', 'internal_write', true, '{"tools":["service_steps.complete"],"agent":"services"}'::jsonb),
  ('alterar_data_prevista_servico', 'Alterar data prevista do servico', 'Atualiza prazo permitido com confirmacao.', 'internal_write', true, '{"tools":["services.update_due_date"],"agent":"services"}'::jsonb),
  ('resumir_cliente', 'Resumir cliente', 'Monta resumo operacional de cliente permitido.', 'read', false, '{"tools":["clients.summarize"],"agent":"clients"}'::jsonb),
  ('buscar_documento', 'Buscar documento', 'Busca documentos e trechos processados.', 'read', false, '{"tools":["documents.search","document_search"],"agent":"documents"}'::jsonb),
  ('responder_documento_com_citacoes', 'Responder documento com citacoes', 'Responde somente com evidencia documental citavel.', 'read', false, '{"tools":["document_answer"],"agent":"documents"}'::jsonb),
  ('processar_documento_inbox', 'Processar documento da caixa de entrada', 'Encaminha anexo autenticado ao worker documental.', 'internal_write', false, '{"tools":["document_ingest"],"agent":"documents"}'::jsonb),
  ('criar_tarefa', 'Criar tarefa', 'Cria tarefa operacional para usuario permitido.', 'internal_write', true, '{"tools":["tasks.create_checklist_item"],"agent":"routine"}'::jsonb),
  ('criar_lembrete', 'Criar lembrete', 'Cria interacao com lembrete pelo fluxo atual.', 'internal_write', true, '{"tools":["clients.create_interaction"],"agent":"routine"}'::jsonb),
  ('listar_jobs_buscageo', 'Listar jobs BuscaGEO', 'Consulta jobs reais do BuscaGEO.', 'read', false, '{"tools":["geo.buscageo_jobs.list"],"agent":"tools"}'::jsonb),
  ('listar_jobs_analise_ambiental', 'Listar jobs de analise ambiental', 'Consulta jobs reais da Analise Ambiental.', 'read', false, '{"tools":["geo.environmental_jobs.list"],"agent":"tools"}'::jsonb),
  ('briefing_manha', 'Briefing da manha', 'Executa o agente real de briefing.', 'read', false, '{"tools":["agents.briefing.run"],"agent":"routine"}'::jsonb),
  ('revisao_semanal', 'Revisao semanal', 'Executa revisao semanal conforme permissao.', 'read', false, '{"tools":["agents.weekly_review.run"],"agent":"routine"}'::jsonb)
on conflict (skill_key) do update set
  name = excluded.name,
  description = excluded.description,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  config = excluded.config,
  updated_at = now();

alter table public.sophia_skill_runs enable row level security;
alter table public.sophia_graph_traces enable row level security;
alter table public.sophia_memory_links enable row level security;
alter table public.sophia_rule_approvals enable row level security;

drop policy if exists "sophia_skill_runs_org_member" on public.sophia_skill_runs;
create policy "sophia_skill_runs_org_member" on public.sophia_skill_runs
for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_skill_runs.organization_id and om.user_id = auth.uid() and om.status = 'active')
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_skill_runs.organization_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists "sophia_graph_traces_org_member" on public.sophia_graph_traces;
create policy "sophia_graph_traces_org_member" on public.sophia_graph_traces
for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_graph_traces.organization_id and om.user_id = auth.uid() and om.status = 'active')
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_graph_traces.organization_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists "sophia_memory_links_org_member" on public.sophia_memory_links;
create policy "sophia_memory_links_org_member" on public.sophia_memory_links
for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_memory_links.organization_id and om.user_id = auth.uid() and om.status = 'active')
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_memory_links.organization_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists "sophia_rule_approvals_owner" on public.sophia_rule_approvals;
create policy "sophia_rule_approvals_owner" on public.sophia_rule_approvals
for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_rule_approvals.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner')
) with check (
  approved_by = auth.uid() and exists (select 1 from public.organization_members om where om.organization_id = sophia_rule_approvals.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role = 'owner')
);

drop policy if exists "sophia_eval_cases_owner_access" on public.sophia_eval_cases;
drop policy if exists "sophia_eval_cases_technical_access" on public.sophia_eval_cases;
create policy "sophia_eval_cases_technical_access" on public.sophia_eval_cases
for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_eval_cases.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner', 'admin'))
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_eval_cases.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner', 'admin'))
);

drop policy if exists "sophia_eval_runs_owner_access" on public.sophia_eval_runs;
drop policy if exists "sophia_eval_runs_technical_access" on public.sophia_eval_runs;
create policy "sophia_eval_runs_technical_access" on public.sophia_eval_runs
for all using (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_eval_runs.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner', 'admin'))
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = sophia_eval_runs.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner', 'admin'))
);

-- Traces armazenam apenas resumos de decisao. Inputs completos e secrets nao devem ser gravados aqui.
