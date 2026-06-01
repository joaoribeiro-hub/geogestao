-- Ajuste pontual do fluxo Georreferenciamento.
-- Remove Proposta/Contrato do fluxo oficial exibido no Kanban e move cards
-- antigos dessa coluna para Aguardando documentos.

with geo_board as (
  select id
  from public.service_boards
  where slug = 'georreferenciamento'
  limit 1
),
desired(name, slug, position) as (
  values
    ('Aguardando documentos', 'aguardando-documentos', 1),
    ('Geo em Andamento', 'geo-em-andamento', 2),
    ('Prioridade', 'prioridade', 3),
    ('Em atraso', 'em-atraso', 4),
    ('Geo Protocolado no Cartorio', 'geo-protocolado-cartorio', 5),
    ('Geo Protocolado no INCRA', 'geo-protocolado-incra', 6),
    ('Geo - Pendencia de Confrontante', 'geo-pendencia-confrontante', 7),
    ('Antigos a concluir', 'antigos-a-concluir', 8),
    ('Geo Concluido', 'geo-concluido', 9),
    ('Servico perdido', 'servico-perdido', 10)
)
insert into public.service_columns (board_id, name, slug, position)
select geo_board.id, desired.name, desired.slug, desired.position
from geo_board
cross join desired
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position,
    updated_at = now();

with geo_board as (
  select id
  from public.service_boards
  where slug = 'georreferenciamento'
  limit 1
),
target as (
  select id as awaiting_id
  from public.service_columns
  where board_id = (select id from geo_board)
    and slug = 'aguardando-documentos'
  order by position, created_at
  limit 1
),
legacy as (
  select id
  from public.service_columns
  where board_id = (select id from geo_board)
    and slug = 'proposta-contrato'
  limit 1
)
update public.service_cards sc
set column_id = target.awaiting_id,
    updated_at = now()
from legacy
cross join target
where sc.column_id = legacy.id
  and target.awaiting_id is not null;

notify pgrst, 'reload schema';
