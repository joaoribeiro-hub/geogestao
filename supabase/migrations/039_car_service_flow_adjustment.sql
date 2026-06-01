-- Ajuste pontual do fluxo CAR.
-- Mantem dados existentes, move cards de colunas removidas para destinos seguros
-- e deixa a UI trabalhar somente com as colunas oficiais do fluxo CAR.

with car_board as (
  select id
  from public.service_boards
  where slug = 'car'
  limit 1
),
desired(name, slug, position) as (
  values
    ('Aguardando documentos', 'aguardando-documentos', 1),
    ('CAR em Retificacao', 'car-em-retificacao', 2),
    ('CAR em Andamento', 'car-em-andamento', 3),
    ('Prioridade', 'prioridade', 4),
    ('Em atraso', 'em-atraso', 5),
    ('Aguardando Sincronizacao', 'aguardando-sincronizacao', 6),
    ('Antigos a concluir', 'antigos-a-concluir', 7),
    ('CAR Concluido', 'car-concluido', 8)
)
insert into public.service_columns (board_id, name, slug, position)
select car_board.id, desired.name, desired.slug, desired.position
from car_board
cross join desired
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position,
    updated_at = now();

with car_board as (
  select id
  from public.service_boards
  where slug = 'car'
  limit 1
),
targets as (
  select
    (
      select id
      from public.service_columns
      where board_id = (select id from car_board)
        and slug = 'aguardando-documentos'
      order by position, created_at
      limit 1
    ) as awaiting_id,
    (
      select id
      from public.service_columns
      where board_id = (select id from car_board)
        and slug = 'aguardando-sincronizacao'
      order by position, created_at
      limit 1
    ) as sync_id
),
legacy as (
  select id, slug
  from public.service_columns
  where board_id = (select id from car_board)
    and slug in ('proposta-contrato', 'car-protocolado-em-analise')
)
update public.service_cards sc
set column_id = case
    when legacy.slug = 'car-protocolado-em-analise' then targets.sync_id
    else targets.awaiting_id
  end,
  updated_at = now()
from legacy
cross join targets
where sc.column_id = legacy.id
  and sc.organization_id is not null
  and (
    (legacy.slug = 'car-protocolado-em-analise' and targets.sync_id is not null)
    or (legacy.slug <> 'car-protocolado-em-analise' and targets.awaiting_id is not null)
  );

notify pgrst, 'reload schema';
