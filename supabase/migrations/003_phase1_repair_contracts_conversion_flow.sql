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
  add column if not exists service_type text;

update public.proposals
set service_type = case
  when lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(comments, '')) ~ '\bcar\b|cadastro ambiental'
    then 'car'
  when lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(comments, '')) ~ '\bitr\b|ccir'
    then 'itr-ccir'
  when lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(comments, '')) ~ 'geo|georreferenciamento|sigef|incra'
    then 'georreferenciamento'
  else 'outros-servicos'
end
where service_type is null
  or service_type not in ('georreferenciamento', 'car', 'itr-ccir', 'outros-servicos');

alter table public.proposals
  alter column service_type set default 'outros-servicos',
  alter column service_type set not null;

do $$
begin
  alter table public.proposals
    add constraint proposals_service_type_check
    check (service_type in ('georreferenciamento', 'car', 'itr-ccir', 'outros-servicos'));
exception
  when duplicate_object then null;
end $$;

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

alter table public.service_cards
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null,
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;

alter table public.revenues
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;

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
where sc.id = ranked_service_cards.id
  and (
    sc.proposal_id is distinct from case
      when ranked_service_cards.card_rank = 1 then ranked_service_cards.source_proposal_id
      else null
    end
    or sc.created_from_proposal_id is distinct from case
      when ranked_service_cards.card_rank = 1
        then coalesce(sc.created_from_proposal_id, ranked_service_cards.source_proposal_id)
      else null
    end
  );

with ranked_revenues as (
  select
    id,
    row_number() over (
      partition by proposal_id
      order by created_at, id
    ) as revenue_rank
  from public.revenues
  where proposal_id is not null
    and category = 'Proposta aprovada'
)
update public.revenues r
set proposal_id = null
from ranked_revenues
where r.id = ranked_revenues.id
  and ranked_revenues.revenue_rank > 1;

create unique index if not exists service_cards_proposal_id_unique_idx
  on public.service_cards(proposal_id)
  where proposal_id is not null;

create unique index if not exists revenues_auto_proposal_once_idx
  on public.revenues(proposal_id)
  where proposal_id is not null
    and category = 'Proposta aprovada';

create index if not exists contracts_client_id_idx on public.contracts(client_id);
create index if not exists contracts_status_idx on public.contracts(status);
create index if not exists service_cards_contract_id_idx on public.service_cards(contract_id);
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
