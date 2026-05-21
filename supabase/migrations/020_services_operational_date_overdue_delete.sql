-- FASE UX-ORG-SERVICES-1 - data operacional, coluna Em atraso e apoio a exclusao segura.
-- Execute primeiro no Supabase de teste.

alter table if exists public.service_cards
  add column if not exists service_date date,
  add column if not exists completed_at date;

alter table if exists public.service_cards
  alter column service_date set default current_date;

update public.service_cards
set service_date = created_at::date
where service_date is null;

create index if not exists service_cards_organization_service_date_idx
  on public.service_cards(organization_id, service_date);

create index if not exists service_cards_organization_due_date_idx
  on public.service_cards(organization_id, due_date);

create index if not exists service_cards_completed_at_idx
  on public.service_cards(completed_at)
  where completed_at is not null;

with desired(board_slug, name, slug, position) as (
  values
    ('georreferenciamento', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('georreferenciamento', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('georreferenciamento', 'Geo em Andamento', 'geo-em-andamento', 3),
    ('georreferenciamento', 'Prioridade', 'prioridade', 4),
    ('georreferenciamento', 'Em atraso', 'em-atraso', 5),
    ('georreferenciamento', 'Geo Protocolado no Cartorio', 'geo-protocolado-cartorio', 6),
    ('georreferenciamento', 'Geo Protocolado no INCRA', 'geo-protocolado-incra', 7),
    ('georreferenciamento', 'Geo - Pendencia de Confrontante', 'geo-pendencia-confrontante', 8),
    ('georreferenciamento', 'Geo Concluido', 'geo-concluido', 9),
    ('georreferenciamento', 'Servico perdido', 'servico-perdido', 10),
    ('car', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('car', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('car', 'CAR em Andamento', 'car-em-andamento', 3),
    ('car', 'Prioridade', 'prioridade', 4),
    ('car', 'Em atraso', 'em-atraso', 5),
    ('car', 'CAR Protocolado/Em Analise', 'car-protocolado-em-analise', 6),
    ('car', 'CAR Concluido', 'car-concluido', 7),
    ('car', 'Servico perdido', 'servico-perdido', 8),
    ('itr-ccir', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('itr-ccir', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('itr-ccir', 'ITR/CCIR em Andamento', 'itr-ccir-em-andamento', 3),
    ('itr-ccir', 'Prioridade', 'prioridade', 4),
    ('itr-ccir', 'Em atraso', 'em-atraso', 5),
    ('itr-ccir', 'Protocolado/Enviado', 'protocolado-enviado', 6),
    ('itr-ccir', 'Concluido', 'concluido', 7),
    ('itr-ccir', 'Servico perdido', 'servico-perdido', 8),
    ('outros-servicos', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('outros-servicos', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('outros-servicos', 'Em Andamento', 'em-andamento', 3),
    ('outros-servicos', 'Prioridade', 'prioridade', 4),
    ('outros-servicos', 'Em atraso', 'em-atraso', 5),
    ('outros-servicos', 'Concluido', 'concluido', 6),
    ('outros-servicos', 'Servico perdido', 'servico-perdido', 7)
)
insert into public.service_columns (board_id, name, slug, position)
select b.id, d.name, d.slug, d.position
from desired d
join public.service_boards b on b.slug = d.board_slug
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position,
    updated_at = now();

notify pgrst, 'reload schema';
