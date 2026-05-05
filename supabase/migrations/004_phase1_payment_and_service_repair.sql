create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  proposal_id uuid references public.proposals(id) on delete set null,
  service_card_id uuid references public.service_cards(id) on delete set null,
  title text not null,
  description text,
  amount numeric(14,2),
  status text not null default 'contrato_a_gerar'
    check (
      status in (
        'contrato_a_gerar',
        'contrato_gerado',
        'enviado_para_assinatura',
        'assinado',
        'em_execucao',
        'finalizado',
        'cancelado'
      )
    ),
  pdf_file_path text,
  sent_at date,
  signed_at date,
  starts_at date,
  ends_at date,
  important_dates_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proposals
  add column if not exists service_type text,
  add column if not exists payment_status text,
  add column if not exists converted_at timestamptz,
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists service_card_id uuid references public.service_cards(id) on delete set null;

alter table public.proposals drop constraint if exists proposals_service_type_check;
alter table public.proposals drop constraint if exists proposals_payment_status_check;

update public.proposals
set service_type = case
  when service_type in ('itr-ccir', 'itr_ccir') then 'itr_ccir'
  when service_type in ('outros-servicos', 'outros_servicos') then 'outros_servicos'
  when service_type in ('georreferenciamento', 'car') then service_type
  when lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(comments, '')) ~ '\bcar\b|cadastro ambiental'
    then 'car'
  when lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(comments, '')) ~ '\bitr\b|ccir'
    then 'itr_ccir'
  when lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(comments, '')) ~ 'geo|georreferenciamento|sigef|incra'
    then 'georreferenciamento'
  else 'outros_servicos'
end
where service_type is null
  or service_type not in ('georreferenciamento', 'car', 'itr_ccir', 'outros_servicos');

update public.proposals
set payment_status = 'pagamento_nao_efetuado'
where payment_status is null
  or payment_status not in ('pagamento_nao_efetuado', 'pagamento_efetuado');

alter table public.proposals
  alter column service_type set default 'outros_servicos',
  alter column service_type set not null,
  alter column payment_status set default 'pagamento_nao_efetuado',
  alter column payment_status set not null;

alter table public.proposals
  add constraint proposals_service_type_check
  check (service_type in ('georreferenciamento', 'car', 'itr_ccir', 'outros_servicos'));

alter table public.proposals
  add constraint proposals_payment_status_check
  check (payment_status in ('pagamento_nao_efetuado', 'pagamento_efetuado'));

alter table public.service_cards
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null,
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists service_type text,
  add column if not exists payment_status text;

alter table public.service_cards drop constraint if exists service_cards_service_type_check;
alter table public.service_cards drop constraint if exists service_cards_payment_status_check;

update public.service_cards sc
set service_type = coalesce(
  case
    when sc.service_type in ('itr-ccir', 'itr_ccir') then 'itr_ccir'
    when sc.service_type in ('outros-servicos', 'outros_servicos') then 'outros_servicos'
    when sc.service_type in ('georreferenciamento', 'car') then sc.service_type
    else null
  end,
  case
    when sb.slug = 'itr-ccir' then 'itr_ccir'
    when sb.slug = 'outros-servicos' then 'outros_servicos'
    when sb.slug in ('georreferenciamento', 'car') then sb.slug
    else 'outros_servicos'
  end
),
payment_status = coalesce(
  case
    when sc.payment_status in ('pagamento_nao_efetuado', 'pagamento_efetuado')
      then sc.payment_status
    else null
  end,
  'pagamento_nao_efetuado'
)
from public.service_columns scol
join public.service_boards sb on sb.id = scol.board_id
where sc.column_id = scol.id;

update public.service_cards sc
set
  service_type = coalesce(p.service_type, sc.service_type),
  payment_status = coalesce(p.payment_status, sc.payment_status)
from public.proposals p
where p.id = coalesce(sc.proposal_id, sc.created_from_proposal_id);

alter table public.service_cards
  alter column payment_status set default 'pagamento_nao_efetuado',
  alter column payment_status set not null;

alter table public.service_cards
  add constraint service_cards_service_type_check
  check (service_type is null or service_type in ('georreferenciamento', 'car', 'itr_ccir', 'outros_servicos'));

alter table public.service_cards
  add constraint service_cards_payment_status_check
  check (payment_status in ('pagamento_nao_efetuado', 'pagamento_efetuado'));

alter table public.revenues
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists auto_generated boolean not null default false;

update public.revenues
set auto_generated = true
where category in ('Proposta aprovada', 'Pagamento de proposta');

delete from public.revenues
where auto_generated = true
  and category = 'Proposta aprovada'
  and status = 'pending'
  and paid_at is null;

with ranked_contracts as (
  select
    id,
    row_number() over (
      partition by proposal_id
      order by
        case when service_card_id is not null then 0 else 1 end,
        created_at,
        id
    ) as contract_rank
  from public.contracts
  where proposal_id is not null
)
update public.contracts c
set proposal_id = null
from ranked_contracts
where c.id = ranked_contracts.id
  and ranked_contracts.contract_rank > 1;

create unique index if not exists contracts_proposal_id_unique_idx
  on public.contracts(proposal_id)
  where proposal_id is not null;

with ranked_service_cards as (
  select
    sc.id,
    coalesce(sc.proposal_id, sc.created_from_proposal_id) as source_proposal_id,
    row_number() over (
      partition by coalesce(sc.proposal_id, sc.created_from_proposal_id)
      order by
        case when p.converted_service_card_id = sc.id then 0 else 1 end,
        sc.created_at,
        sc.id
    ) as card_rank
  from public.service_cards sc
  left join public.proposals p
    on p.id = coalesce(sc.proposal_id, sc.created_from_proposal_id)
  where coalesce(sc.proposal_id, sc.created_from_proposal_id) is not null
)
update public.service_cards sc
set proposal_id = case
    when ranked_service_cards.card_rank = 1 then ranked_service_cards.source_proposal_id
    else null
  end,
  created_from_proposal_id = case
    when ranked_service_cards.card_rank = 1
      then coalesce(sc.created_from_proposal_id, ranked_service_cards.source_proposal_id)
    else null
  end
from ranked_service_cards
where sc.id = ranked_service_cards.id;

create unique index if not exists service_cards_proposal_id_unique_idx
  on public.service_cards(proposal_id)
  where proposal_id is not null;

with ranked_revenues as (
  select
    id,
    row_number() over (
      partition by proposal_id
      order by
        case when status = 'paid' then 0 else 1 end,
        created_at,
        id
    ) as revenue_rank
  from public.revenues
  where proposal_id is not null
    and auto_generated = true
)
delete from public.revenues r
using ranked_revenues
where r.id = ranked_revenues.id
  and ranked_revenues.revenue_rank > 1;

create unique index if not exists revenues_auto_generated_proposal_once_idx
  on public.revenues(proposal_id)
  where proposal_id is not null
    and auto_generated = true;

update public.proposals p
set
  service_card_id = coalesce(p.service_card_id, p.converted_service_card_id, sc.id),
  converted_service_card_id = coalesce(p.converted_service_card_id, p.service_card_id, sc.id),
  contract_id = coalesce(p.contract_id, c.id),
  payment_status = case
    when r.id is not null then 'pagamento_efetuado'
    else p.payment_status
  end
from public.service_cards sc
left join public.contracts c on c.proposal_id = sc.proposal_id
left join public.revenues r
  on r.proposal_id = sc.proposal_id
  and r.auto_generated = true
  and r.status = 'paid'
where sc.proposal_id = p.id
  and p.stage = 'execution';

update public.contracts c
set service_card_id = sc.id
from public.service_cards sc
where sc.proposal_id = c.proposal_id
  and c.service_card_id is null;

update public.service_cards sc
set
  contract_id = coalesce(sc.contract_id, p.contract_id),
  payment_status = p.payment_status
from public.proposals p
where p.id = sc.proposal_id;

create index if not exists contracts_client_id_idx on public.contracts(client_id);
create index if not exists contracts_status_idx on public.contracts(status);
create index if not exists proposals_contract_id_idx on public.proposals(contract_id);
create index if not exists proposals_service_card_id_idx on public.proposals(service_card_id);
create index if not exists proposals_service_type_idx on public.proposals(service_type);
create index if not exists service_cards_contract_id_idx on public.service_cards(contract_id);
create index if not exists service_cards_service_type_idx on public.service_cards(service_type);
create index if not exists service_cards_payment_status_idx on public.service_cards(payment_status);
create index if not exists revenues_contract_id_idx on public.revenues(contract_id);

drop trigger if exists set_contracts_updated_at on public.contracts;
create trigger set_contracts_updated_at
before update on public.contracts
for each row execute function public.set_updated_at();

alter table public.contracts enable row level security;

drop policy if exists "contracts_crud_authenticated" on public.contracts;
create policy "contracts_crud_authenticated" on public.contracts
for all to authenticated using (true) with check (true);

do $$
begin
  alter table public.attachments drop constraint if exists attachments_entity_type_check;

  alter table public.attachments
    add constraint attachments_entity_type_check
    check (
      entity_type in (
        'client',
        'proposal',
        'service_card',
        'contract',
        'revenue',
        'expense',
        'document_template',
        'legislation_item'
      )
    );
end $$;

notify pgrst, 'reload schema';
