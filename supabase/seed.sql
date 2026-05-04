insert into public.service_boards (id, name, slug, description, position)
values
  ('10000000-0000-4000-8000-000000000001', 'Georreferenciamento', 'georreferenciamento', 'Fluxo para certificacao, cartorio, INCRA e confrontantes.', 1),
  ('10000000-0000-4000-8000-000000000002', 'CAR', 'car', 'Cadastro Ambiental Rural e retificacoes.', 2),
  ('10000000-0000-4000-8000-000000000003', 'ITR/CCIR', 'itr-ccir', 'Declaracoes, regularizacoes e emissao de certificados.', 3),
  ('10000000-0000-4000-8000-000000000004', 'Outros Servicos', 'outros-servicos', 'Demandas tecnicas gerais do escritorio.', 4)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    position = excluded.position;

insert into public.service_columns (id, board_id, name, slug, position)
values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Geo em Andamento', 'geo-em-andamento', 1),
  ('11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Geo Protocolado no Cartorio', 'geo-protocolado-cartorio', 2),
  ('11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Geo Protocolado no INCRA', 'geo-protocolado-incra', 3),
  ('11000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Geo - Pendencia de Confrontante', 'geo-pendencia-confrontante', 4),
  ('11000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Geo Concluido', 'geo-concluido', 5),
  ('12000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'CAR em Andamento', 'car-em-andamento', 1),
  ('12000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'CAR em Retificacao', 'car-em-retificacao', 2),
  ('12000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'CAR Concluido', 'car-concluido', 3),
  ('13000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Em Andamento', 'em-andamento', 1),
  ('13000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'Concluido', 'concluido', 2),
  ('14000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'A Fazer', 'a-fazer', 1),
  ('14000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'Em Andamento', 'em-andamento', 2),
  ('14000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'Concluido', 'concluido', 3)
on conflict (board_id, slug) do update
set name = excluded.name,
    position = excluded.position;

insert into public.clients (id, kind, name, document, email, phone, address, notes)
values
  ('20000000-0000-4000-8000-000000000001', 'pf', 'Joao Pereira', '123.456.789-09', 'joao.pereira@example.com', '(11) 99999-1001', 'Fazenda Boa Vista, Zona Rural', 'Cliente recorrente de georreferenciamento.'),
  ('20000000-0000-4000-8000-000000000002', 'pj', 'Agro Santa Clara Ltda', '12.345.678/0001-90', 'contato@agrosantaclara.com.br', '(34) 3333-2000', 'Rodovia MG-000, km 20', 'Demandas de CAR e ITR.'),
  ('20000000-0000-4000-8000-000000000003', 'pf', 'Maria Fernandes', '987.654.321-00', 'maria.fernandes@example.com', '(31) 98888-3000', 'Sitio Sao Bento', 'Aguardando documentos do confrontante.'),
  ('20000000-0000-4000-8000-000000000004', 'pj', 'Condominio Rural Horizonte', '45.111.222/0001-10', 'adm@horizonterural.com.br', '(62) 3222-9090', 'Estrada Municipal 12', 'Interessado em regularizacao fundiaria.')
on conflict (id) do update
set name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    notes = excluded.notes;

insert into public.client_interactions (client_id, type, occurred_at, description)
values
  ('20000000-0000-4000-8000-000000000001', 'whatsapp', now() - interval '4 days', 'Solicitou previsao de protocolo no INCRA.'),
  ('20000000-0000-4000-8000-000000000002', 'email', now() - interval '2 days', 'Enviou matriculas atualizadas para revisao.'),
  ('20000000-0000-4000-8000-000000000003', 'ligacao', now() - interval '1 day', 'Informada pendencia de assinatura do confrontante.');

insert into public.proposals (id, client_id, title, description, value, sent_at, valid_until, comments, stage, position)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Georreferenciamento de imovel rural', 'Area estimada de 120 ha com certificacao SIGEF.', 18500.00, current_date - 5, current_date + 10, 'Cliente pediu parcelamento.', 'negotiation', 1),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Retificacao de CAR', 'Ajuste de reserva legal e areas consolidadas.', 4200.00, current_date - 3, current_date + 12, null, 'sent', 1),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', 'Regularizacao fundiaria preliminar', 'Diagnostico documental e plano de acao.', 9600.00, null, null, 'Preparar proposta detalhada.', 'todo', 1)
on conflict (id) do update
set title = excluded.title,
    value = excluded.value,
    stage = excluded.stage;

insert into public.service_cards (id, column_id, client_id, title, description, priority, due_date, checklist_percent, custom_fields_json, position)
values
  ('40000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Geo Fazenda Boa Vista', 'Levantamento de campo concluido, processando pecas tecnicas.', 'high', current_date + 7, 40, '{"area_ha": 120, "matricula": "12.345"}', 1),
  ('40000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'Geo Sitio Sao Bento', 'Aguardando assinatura do confrontante norte.', 'urgent', current_date - 2, 65, '{"pendencia": "confrontante norte"}', 1),
  ('40000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'CAR Agro Santa Clara', 'Revisao de camadas ambientais.', 'medium', current_date + 12, 25, '{"sicar": "MG-0000000"}', 1),
  ('40000000-0000-4000-8000-000000000004', '13000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'ITR 2026', 'Conferencia de areas declaradas.', 'medium', current_date + 20, 0, '{}', 1)
on conflict (id) do update
set title = excluded.title,
    column_id = excluded.column_id,
    priority = excluded.priority,
    due_date = excluded.due_date;

insert into public.checklists (id, service_card_id, title, position)
values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Documentos GEO', 1),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', 'CAR', 1)
on conflict (id) do nothing;

insert into public.checklist_items (checklist_id, title, is_done, position)
values
  ('50000000-0000-4000-8000-000000000001', 'Matricula atualizada', true, 1),
  ('50000000-0000-4000-8000-000000000001', 'CCIR', true, 2),
  ('50000000-0000-4000-8000-000000000001', 'Certidao negativa', false, 3),
  ('50000000-0000-4000-8000-000000000002', 'Arquivo shapefile', true, 1),
  ('50000000-0000-4000-8000-000000000002', 'Recibo SICAR', false, 2);

insert into public.revenues (id, client_id, proposal_id, service_card_id, description, category, amount, due_date, paid_at, status)
values
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Entrada GEO Boa Vista', 'Georreferenciamento', 5500.00, current_date + 5, null, 'pending'),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', 'Retificacao CAR', 'CAR', 4200.00, current_date - 1, null, 'overdue')
on conflict (id) do update
set amount = excluded.amount,
    status = excluded.status;

insert into public.expenses (id, client_id, service_card_id, description, category, amount, due_date, paid_at, status)
values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Diaria equipe de campo', 'Campo', 1800.00, current_date + 3, null, 'pending'),
  ('70000000-0000-4000-8000-000000000002', null, null, 'Licenca software topografia', 'Software', 650.00, current_date + 15, null, 'pending')
on conflict (id) do update
set amount = excluded.amount,
    status = excluded.status;

insert into public.document_templates (id, title, category, version, status, description)
values
  ('80000000-0000-4000-8000-000000000001', 'Modelo de Proposta GEO', 'Propostas', '1.0', 'vigente', 'Modelo comercial para georreferenciamento rural.'),
  ('80000000-0000-4000-8000-000000000002', 'Checklist de Documentos CAR', 'Operacional', '1.1', 'vigente', 'Lista padrao de documentos e arquivos para CAR.')
on conflict (id) do update
set title = excluded.title,
    version = excluded.version,
    status = excluded.status;

insert into public.legislation_items (id, title, category, official_link, technical_summary, practical_points, status)
values
  ('90000000-0000-4000-8000-000000000001', 'Lei 10.267/2001', 'Georreferenciamento', 'https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10267.htm', 'Altera regras de identificacao de imoveis rurais.', 'Verificar obrigatoriedade de georreferenciamento conforme area e ato registral.', 'vigente'),
  ('90000000-0000-4000-8000-000000000002', 'Instrucoes Normativas do INCRA', 'INCRA/SIGEF', 'https://www.gov.br/incra', 'Normas operacionais para certificacao e cadastro rural.', 'Confirmar versao aplicavel antes de protocolar.', 'atencao')
on conflict (id) do update
set title = excluded.title,
    status = excluded.status;
