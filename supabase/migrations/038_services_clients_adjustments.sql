-- Ajustes pontuais de Servicos/Clientes.
-- Adiciona a coluna "Antigos a concluir" aos fluxos de Servicos.

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
    ('georreferenciamento', 'Antigos a concluir', 'antigos-a-concluir', 9),
    ('georreferenciamento', 'Geo Concluido', 'geo-concluido', 10),
    ('georreferenciamento', 'Servico perdido', 'servico-perdido', 11),
    ('car', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('car', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('car', 'CAR em Andamento', 'car-em-andamento', 3),
    ('car', 'Prioridade', 'prioridade', 4),
    ('car', 'Em atraso', 'em-atraso', 5),
    ('car', 'CAR Protocolado/Em Analise', 'car-protocolado-em-analise', 6),
    ('car', 'Antigos a concluir', 'antigos-a-concluir', 7),
    ('car', 'CAR Concluido', 'car-concluido', 8),
    ('car', 'Servico perdido', 'servico-perdido', 9),
    ('itr-ccir', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('itr-ccir', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('itr-ccir', 'ITR/CCIR em Andamento', 'itr-ccir-em-andamento', 3),
    ('itr-ccir', 'Prioridade', 'prioridade', 4),
    ('itr-ccir', 'Em atraso', 'em-atraso', 5),
    ('itr-ccir', 'Protocolado/Enviado', 'protocolado-enviado', 6),
    ('itr-ccir', 'Antigos a concluir', 'antigos-a-concluir', 7),
    ('itr-ccir', 'Concluido', 'concluido', 8),
    ('itr-ccir', 'Servico perdido', 'servico-perdido', 9),
    ('outros-servicos', 'Aguardando documentos', 'aguardando-documentos', 1),
    ('outros-servicos', 'Proposta/Contrato', 'proposta-contrato', 2),
    ('outros-servicos', 'Em Andamento', 'em-andamento', 3),
    ('outros-servicos', 'Prioridade', 'prioridade', 4),
    ('outros-servicos', 'Em atraso', 'em-atraso', 5),
    ('outros-servicos', 'Antigos a concluir', 'antigos-a-concluir', 6),
    ('outros-servicos', 'Concluido', 'concluido', 7),
    ('outros-servicos', 'Servico perdido', 'servico-perdido', 8)
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
