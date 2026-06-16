-- Adiciona a coluna operacional "Prioridade maxima" aos fluxos de servicos.
-- A coluna fica imediatamente antes de "Prioridade" e aceita movimentacao manual
-- pelo mesmo mecanismo de drag-and-drop das demais colunas.

with desired(board_slug, name, slug, position) as (
  values
    ('georreferenciamento', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('georreferenciamento', 'Geo em Andamento', 'geo-em-andamento', 2),
    ('georreferenciamento', 'Prioridade máxima', 'prioridade_maxima', 3),
    ('georreferenciamento', 'Prioridade', 'prioridade', 4),
    ('georreferenciamento', 'Em atraso', 'em-atraso', 5),
    ('georreferenciamento', 'Geo Protocolado no Cartorio', 'geo-protocolado-cartorio', 6),
    ('georreferenciamento', 'Geo Protocolado no INCRA', 'geo-protocolado-incra', 7),
    ('georreferenciamento', 'Geo - Pendencia de Confrontante', 'geo-pendencia-confrontante', 8),
    ('georreferenciamento', 'Antigos a concluir', 'antigos-a-concluir', 9),
    ('georreferenciamento', 'Geo Concluido', 'geo-concluido', 10),
    ('georreferenciamento', 'Servico perdido', 'servico-perdido', 11),

    ('car', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('car', 'CAR em Retificacao', 'car-em-retificacao', 2),
    ('car', 'CAR em Andamento', 'car-em-andamento', 3),
    ('car', 'Prioridade máxima', 'prioridade_maxima', 4),
    ('car', 'Prioridade', 'prioridade', 5),
    ('car', 'Em atraso', 'em-atraso', 6),
    ('car', 'Aguardando Sincronizacao', 'aguardando-sincronizacao', 7),
    ('car', 'Antigos a concluir', 'antigos-a-concluir', 8),
    ('car', 'CAR Concluido', 'car-concluido', 9),

    ('itr_ccir', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('itr_ccir', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('itr_ccir', 'ITR/CCIR em Andamento', 'itr-ccir-em-andamento', 3),
    ('itr_ccir', 'Prioridade máxima', 'prioridade_maxima', 4),
    ('itr_ccir', 'Prioridade', 'prioridade', 5),
    ('itr_ccir', 'Em atraso', 'em-atraso', 6),
    ('itr_ccir', 'Protocolado/Enviado', 'protocolado-enviado', 7),
    ('itr_ccir', 'Antigos a concluir', 'antigos-a-concluir', 8),
    ('itr_ccir', 'Concluido', 'concluido', 9),
    ('itr_ccir', 'Servico perdido', 'servico-perdido', 10),

    ('outros_servicos', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('outros_servicos', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('outros_servicos', 'Em Andamento', 'em-andamento', 3),
    ('outros_servicos', 'Prioridade máxima', 'prioridade_maxima', 4),
    ('outros_servicos', 'Prioridade', 'prioridade', 5),
    ('outros_servicos', 'Em atraso', 'em-atraso', 6),
    ('outros_servicos', 'Antigos a concluir', 'antigos-a-concluir', 7),
    ('outros_servicos', 'Concluido', 'concluido', 8),
    ('outros_servicos', 'Servico perdido', 'servico-perdido', 9)
)
insert into public.service_columns (board_id, name, slug, position)
select service_boards.id, desired.name, desired.slug, desired.position
from desired
join public.service_boards on service_boards.slug = desired.board_slug
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position,
    updated_at = now();

notify pgrst, 'reload schema';
