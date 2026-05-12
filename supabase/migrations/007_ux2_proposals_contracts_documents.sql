-- Fase UX-2: propostas, contratos, documentos e filtros comerciais.
-- Migration aditiva e segura: nao remove dados e nao altera migrations antigas.

alter table public.proposals
  add column if not exists model_data jsonb not null default '{}'::jsonb,
  add column if not exists pdf_file_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists lost_at timestamptz,
  add column if not exists lost_reason text;

alter table public.contracts
  add column if not exists model_data jsonb not null default '{}'::jsonb,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists clauses_json jsonb not null default '[]'::jsonb,
  add column if not exists signers_json jsonb not null default '[]'::jsonb,
  add column if not exists forum text,
  add column if not exists payment_status text not null default 'pagamento_nao_efetuado';

alter table public.contracts drop constraint if exists contracts_payment_status_check;
alter table public.contracts
  add constraint contracts_payment_status_check
  check (payment_status in ('pagamento_nao_efetuado', 'pagamento_efetuado'));

alter table public.attachments
  add column if not exists category text;

create table if not exists public.proposal_services (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1,
  unit text,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (quantity * unit_price) stored,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_services (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  proposal_service_id uuid references public.proposal_services(id) on delete set null,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1,
  unit text,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (quantity * unit_price) stored,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  description text,
  percentage numeric(6,2),
  amount numeric(14,2),
  due_date date,
  payment_method text,
  status text not null default 'pending',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_installments_owner_check
    check (proposal_id is not null or contract_id is not null),
  constraint payment_installments_status_check
    check (status in ('pending', 'paid', 'overdue', 'canceled'))
);

create index if not exists proposals_stage_created_at_idx
  on public.proposals(stage, created_at);
create index if not exists proposals_sent_at_idx
  on public.proposals(sent_at);
create index if not exists proposals_valid_until_idx
  on public.proposals(valid_until);
create index if not exists proposals_lost_at_idx
  on public.proposals(lost_at);
create index if not exists contracts_status_created_at_idx
  on public.contracts(status, created_at);
create index if not exists contracts_payment_status_idx
  on public.contracts(payment_status);
create index if not exists attachments_entity_category_idx
  on public.attachments(entity_type, entity_id, category);
create index if not exists proposal_services_proposal_id_idx
  on public.proposal_services(proposal_id);
create index if not exists contract_services_contract_id_idx
  on public.contract_services(contract_id);
create index if not exists payment_installments_proposal_id_idx
  on public.payment_installments(proposal_id);
create index if not exists payment_installments_contract_id_idx
  on public.payment_installments(contract_id);
create index if not exists payment_installments_due_date_idx
  on public.payment_installments(due_date);

alter table public.proposal_services enable row level security;
alter table public.contract_services enable row level security;
alter table public.payment_installments enable row level security;

drop policy if exists "proposal_services_authenticated_select" on public.proposal_services;
create policy "proposal_services_authenticated_select"
  on public.proposal_services for select
  using (auth.role() = 'authenticated');

drop policy if exists "proposal_services_authenticated_insert" on public.proposal_services;
create policy "proposal_services_authenticated_insert"
  on public.proposal_services for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "proposal_services_authenticated_update" on public.proposal_services;
create policy "proposal_services_authenticated_update"
  on public.proposal_services for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "proposal_services_authenticated_delete" on public.proposal_services;
create policy "proposal_services_authenticated_delete"
  on public.proposal_services for delete
  using (auth.role() = 'authenticated');

drop policy if exists "contract_services_authenticated_select" on public.contract_services;
create policy "contract_services_authenticated_select"
  on public.contract_services for select
  using (auth.role() = 'authenticated');

drop policy if exists "contract_services_authenticated_insert" on public.contract_services;
create policy "contract_services_authenticated_insert"
  on public.contract_services for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "contract_services_authenticated_update" on public.contract_services;
create policy "contract_services_authenticated_update"
  on public.contract_services for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "contract_services_authenticated_delete" on public.contract_services;
create policy "contract_services_authenticated_delete"
  on public.contract_services for delete
  using (auth.role() = 'authenticated');

drop policy if exists "payment_installments_authenticated_select" on public.payment_installments;
create policy "payment_installments_authenticated_select"
  on public.payment_installments for select
  using (auth.role() = 'authenticated');

drop policy if exists "payment_installments_authenticated_insert" on public.payment_installments;
create policy "payment_installments_authenticated_insert"
  on public.payment_installments for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "payment_installments_authenticated_update" on public.payment_installments;
create policy "payment_installments_authenticated_update"
  on public.payment_installments for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "payment_installments_authenticated_delete" on public.payment_installments;
create policy "payment_installments_authenticated_delete"
  on public.payment_installments for delete
  using (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
