# GeoGestao - Estado Atual do Projeto

Data do checkpoint: 2026-05-11

## Visao geral

GeoGestao e um sistema web de gestao para escritorio de agrimensura com ate 10 usuarios. O objetivo do MVP e substituir parcialmente Trello e planilhas, centralizando CRM, propostas, servicos tecnicos, financeiro basico, anexos, documentos, legislacao e dashboard.

O projeto nao deve ser recriado do zero. A base atual ja esta funcional, com Supabase real conectado via `.env.local`, login funcionando e dados seedados para testes.

## Stack usada

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Componentes no padrao shadcn/ui
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- `@supabase/supabase-js`
- `@supabase/ssr`
- `dnd-kit` para Kanban drag and drop
- Zod para validacao
- React Hook Form para formularios
- ESLint e TypeScript para validacao
- Leaflet para mapa interativo
- OpenStreetMap como camada inicial do mapa
- `@tmcw/togeojson` para converter KML em GeoJSON
- `jszip` para extrair KML de arquivos KMZ
- Vitest para testes unitarios e de regras
- Playwright para testes E2E

## Variaveis de ambiente

Variaveis publicas usadas pelo frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
E2E_RUN_MUTATION_TESTS=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_APPLICATION_CREDENTIALS=
SUPABASE_SERVICE_ROLE_KEY=
MAPBIOMAS_ALERT_API_URL=https://plataforma.alerta.mapbiomas.org/api/v2/graphql
MAPBIOMAS_ALERT_EMAIL=
MAPBIOMAS_ALERT_PASSWORD=
MAPBIOMAS_ALERT_TOKEN=
```

Observacoes:

- A variavel recomendada para projetos Supabase novos e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` permanece como fallback de compatibilidade.
- Nenhuma `service_role key` deve ser usada ou exposta no frontend.
- `.env.local` deve permanecer fora do Git.
- `.env.local` esta listado no `.gitignore`.
- `E2E_TEST_EMAIL` e `E2E_TEST_PASSWORD` sao opcionais e devem apontar para usuario de teste.
- `E2E_RUN_MUTATION_TESTS=true` deve ser usado apenas em Supabase dedicado a testes.
- `OPENAI_API_KEY` e server-side. Nunca criar `NEXT_PUBLIC_OPENAI_API_KEY`.
- Se `OPENAI_API_KEY` nao estiver configurada, o Chat IA retorna erro claro de configuracao e nao chama a OpenAI.
- O Chat IA usa o SDK oficial `openai` e a Responses API apenas com texto nesta fase.
- Variaveis Google/Drive sao opcionais e servem apenas para a origem bruta das bases geograficas. A consulta do app deve usar tabelas ja importadas no Supabase/Postgres.
- `SUPABASE_SERVICE_ROLE_KEY` e permitido apenas em scripts locais/admin de importacao geografica. Nunca usar no frontend.
- Variaveis MapBiomas Alerta sao server-side. Nunca criar `NEXT_PUBLIC_MAPBIOMAS_*`.

## Status da integracao Supabase

- Supabase real ja foi conectado via `.env.local`.
- Login com Supabase Auth ja funciona.
- O app ja abriu em `http://localhost:3000`.
- Dashboard, clientes, propostas e servicos ja foram visualizados com dados seedados.
- Storage esta previsto para anexos.
- Row Level Security foi considerada nas migrations iniciais.

## Comandos para rodar

Instalar dependencias:

```bash
npm install
```

Rodar localmente:

```bash
npm run dev
```

Em ambiente Windows/PowerShell, se `npm.ps1` for bloqueado pela politica de execucao, usar:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev -- --hostname 0.0.0.0 --port 3000
```

URL de preview esperada:

```text
http://localhost:3000
```

Validacoes usadas no projeto:

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run test:coverage
npm run test:e2e
```

No ultimo ciclo de implementacao da Fase 1, essas validacoes passaram.

## Rotas existentes

- `/login` - tela de login.
- `/` - dashboard.
- `/minha-empresa` - area central de configuracoes e cadastros internos.
- `/minha-conta` - dados pessoais, avatar e preferencias da conta.
- `/mapa` - Fazer busca de imovel por CAR Federal, com mapa, historico, bases CAR/INCRA/alertas preparadas e upload KML/KMZ manual preservado.
- `/clientes` - lista e busca de clientes.
- `/clientes/[id]` - detalhe de cliente.
- `/propostas` - dashboard comercial, criacao de propostas e Kanban de propostas.
- `/propostas/[id]` - visualizacao/preview A4 e edicao resumida da proposta.
- `/servicos` - quadros e cards de servicos tecnicos.
- `/servicos/[id]` - detalhe de card/servico tecnico.
- `/financeiro` - receitas, despesas e resumos basicos.
- `/documentos` - biblioteca de modelos/documentos.
- `/legislacao` - biblioteca de legislacao/normas.
- `/anexos` - listagem/envio de anexos.
- `/contratos` - modulo basico de contratos.
- `/contratos/[id]` - detalhe, continuidade por etapas e preview A4 do contrato.

## Modulos ja implementados

### Autenticacao e layout

- Login com Supabase Auth.
- Middleware para protecao de rotas autenticadas.
- Layout base autenticado com menu lateral.
- Perfil de usuario previsto via tabela `profiles`.

### CRM

- CRUD/listagem de clientes PF/PJ.
- Busca de clientes.
- Detalhe de cliente.
- Historico de interacoes com cliente.

### Minha Empresa

- Rota `/minha-empresa`.
- Item "Minha Empresa" no menu lateral.
- Area vinculada a `organizations` na Fase ACCOUNT-1, sem duplicar o conceito de empresa.
- Abas iniciais:
  - Informacoes;
  - Equipe;
  - Clientes;
  - Variaveis financeiras;
  - Documentos internos;
  - Servicos e nichos;
  - Opcoes de propostas;
  - Opcoes de contratos;
  - Bancos;
  - Armazenamento.
- Informacoes da empresa editaveis.
- Clientes espelhados dentro da area, reaproveitando o modulo existente.
- Cadastro basico de servicos e nichos com preco base opcional, unidade de cobranca, descricao e status ativo/inativo.
- Abas avancadas permanecem marcadas como "em breve".

### Minha Conta, organizacoes, planos e Chat IA

- Fase ACCOUNT-1 criada para preparar uso real por empresas e usuarios.
- Rota `/minha-conta` criada com formulario de dados pessoais:
  - nome completo;
  - telefone;
  - data de nascimento;
  - tipo e numero de documento;
  - e-mail de login somente leitura;
  - avatar/foto de perfil;
  - preferencias de e-mail;
  - preferencias basicas da conta.
- Upload de avatar usa Supabase Storage no bucket `attachments`, registra `profiles.avatar_path` e cria attachment `profile/avatar`.
- Base multiempresa preparada em um unico Supabase:
  - `organizations`;
  - `organization_members`;
  - `plans`;
  - `profiles.organization_id`;
  - `organization_id` nas tabelas principais para migracao progressiva.
- Planos iniciais criados:
  - Gratuito;
  - Premium basico.
- Limite de armazenamento por organizacao/plano preparado e aplicado inicialmente em avatar e upload generico de anexos.
- Menu lateral reorganizado em:
  - MENU: Dashboard, Fazer busca de imovel, Propostas, Contratos, Servicos e Financeiro;
  - CONFIGURACOES: Minha Empresa, Minha Conta, Clientes, Documentos, Legislacao e Anexos.
- Chat IA flutuante criado no layout autenticado:
  - chamada a OpenAI somente pelo route handler server-side `/api/ai/chat`;
  - SDK oficial `openai` com `client.responses.create`;
  - contexto basico limitado a organizacao do usuario logado;
  - historico local na sessao do navegador;
  - fallback seguro quando `OPENAI_API_KEY` nao esta configurada;
  - IA somente leitura/geracao de texto nesta fase.

Status da Fase ACCOUNT-1: parcial/implementada no codigo. Pendente aplicar `supabase/migrations/008_account1_organizations_profiles_ai.sql` no Supabase de teste, validar manualmente Minha Conta, Minha Empresa, upload de avatar/anexos e Chat IA, e depois avaliar aplicacao no Supabase oficial.

### Propostas

- Kanban com colunas comerciais.
- Filtro reutilizavel por periodo aplicado a Propostas.
- Cards de resumo da aba Propostas:
  - propostas enviadas;
  - propostas aprovadas;
  - propostas em espera/negociacao;
  - propostas nao aprovadas;
  - valor total enviado;
  - valor total aprovado.
- Grafico simples por status da proposta.
- Botao "Nova Proposta" com dois caminhos:
  - anexar proposta existente em PDF;
  - criar proposta usando modelo do sistema.
- Fluxo de anexar PDF cria proposta, registra anexo e aparece no Kanban.
- Fluxo por modelo cria rascunho inicial em Propostas a Fazer com etapas Registro, Demanda, Prazos, Financeiro, Secoes e Modelo.
- O wizard por modelo foi expandido na Fase UX-2 com campos de registro do empreendimento, demanda, prazos, financeiro, secoes e modelo.
- Cards com cliente, titulo, descricao, valor e responsavel.
- Cards com acoes de visualizar, editar, excluir e baixar PDF quando houver anexo.
- Drag and drop com persistencia.
- Campo obrigatorio de tipo de servico: Georreferenciamento, CAR, ITR/CCIR ou Outros Servicos.
- Criacao de proposta atualiza a tela e mostra feedback visual.
- Fluxo de conversao de proposta em servico foi ajustado na Fase 1 e refinado na UX-2.
- A UI principal agora usa controle de status comercial: Aprovado, Em espera ou Nao aprovado.
- Aprovado move para execucao e cria/reaproveita contrato e service card.
- Em espera move para negociacao.
- Nao aprovado move para perdidas e entra no indicador de valor perdido.
- Arrastar para "Propostas em Execucao" ainda dispara o mesmo fluxo de conversao por compatibilidade.
- Conversao cria/reaproveita contrato e card tecnico, mas nao cria receita automaticamente.
- Controle Pago/Nao pago em propostas em execucao cria/reaproveita receita recebida ou receita a receber e atualiza status de pagamento da proposta e do card tecnico.
- Botao "Voltar" retorna a proposta para "Propostas Enviadas" e remove o servico/receita automatica.
- Rota propria `/propostas/[id]` mostra preview A4, dados da empresa, cliente, servicos, valores, observacoes, links para contrato/servico e download de PDF anexado quando existir.
- Geracao real de PDF em Storage ficou preparada via campos e attachments; nesta fase existe preview A4 com imprimir/salvar como PDF.

### Servicos tecnicos

- Estrutura flexivel de quadros, colunas e cards.
- Quadros seedados para Geo, CAR, ITR/CCIR e Outros Servicos.
- Kanban tecnico com cards arrastaveis.
- Historico simples de movimentacao previsto.
- Checklists por card.
- FASE UX-ORG-SERVICES-1 reorganiza Servicos como centro do sistema.
- Menu principal passa a priorizar Dashboard, Servicos e Financeiro; Propostas e Contratos continuam por rota, mas deixam de ser o foco do menu lateral.
- Tela `/servicos` tem botao `Novo Servico` em modal grande.
- Novo servico entra em `Aguardando documentos`.
- Colunas de Georreferenciamento preparadas para:
  - Aguardando documentos;
  - Proposta/Contrato;
  - Geo em Andamento;
  - Prioridade;
  - Geo Protocolado no Cartorio;
  - Geo Protocolado no INCRA;
  - Geo - Pendencia de Confrontante;
  - Geo Concluido.
- Cards de servico foram simplificados para estilo Trello:
  - cliente;
  - imovel/empreendimento;
  - barra visual de status;
  - indicadores discretos;
  - prazo, prioridade e pagamento.
- Card inteiro abre `/servicos/[id]`.
- Detalhe do servico mostra cliente em destaque, imovel abaixo, tipo como badge pequeno, resumo automatico, chips editaveis de fase/prioridade/pagamento, proposta, contrato, checklists, anexos, membros e historico.
- Checklists padrao sao criados por tipo de servico.
- Financeiro passa a usar botoes `Nova receita` e `Nova despesa` com modal, mantendo as regras existentes.
- Base de Clientes e Clientes dentro de Minha Empresa passam a usar a mesma fonte filtrada por `organization_id`.
- Scripts admin adicionados para Terras Reunidas e reset seguro de organizacao.
- Migration corretiva `017_org_members_rls_service_lost_finance.sql` criada para corrigir recursao de RLS em `organization_members`, adicionar `Servico perdido` a todos os fluxos e preparar financeiro por valor de servico.
- Migration corretiva `018_company_owner_only_permissions.sql` criada para separar `owner` de `admin`: owner edita Minha Empresa; admin operacional visualiza Minha Empresa e continua operando os modulos do sistema.
- Campo de valor do servico usa formato monetario brasileiro, preservando `R$ 16.000,00` como 16000.00.
- Financeiro de Servicos passa a calcular lucro estimado, lucro efetuado e lucro perdido por `organization_id`.

Status da Fase UX-ORG-SERVICES-1: parcial/implementada no codigo. Pendente aplicar `supabase/migrations/015_ux_org_services_center.sql` no Supabase de teste, rodar/validar scripts admin e testar o fluxo completo manualmente.

### Financeiro

- Receitas.
- Despesas.
- Status pendente, pago e vencido.
- Resumos basicos.
- Regra atual da Fase 1: receita automatica so e criada quando o usuario clica em "Pagamento efetuado".
- Regra UX-2: pagamento "Nao pago" cria/reaproveita receita pendente a receber; pagamento "Pago" atualiza/cria receita paga.
- Financeiro usa filtro por periodo.

### Anexos

- Tabela generica `attachments`.
- Vinculo por `entity_type` e `entity_id`.
- Suporte a anexos para clientes, propostas, servicos, receitas, despesas, documentos, legislacao e contratos.

### Documentos

- Biblioteca de modelos/documentos.
- Campos de titulo, categoria, versao, status, descricao e arquivo/anexo.

### Legislacao

- Biblioteca de normas/legislacao.
- Busca e campos de apoio tecnico.

### Fazer busca de imovel / GeoQuery

- Rota `/mapa`.
- Item "Fazer busca de imovel" no menu lateral.
- Fase GEOQUERY-1 criada para consultar imovel rural por CAR Federal usando bases previamente importadas.
- Painel de busca com:
  - numero do CAR Federal;
  - cliente opcional;
  - servico/card tecnico opcional;
  - imovel cadastrado opcional;
  - buffer de alertas proximos.
- Links oficiais:
  - Consulta publica do CAR;
  - Central do CAR / gov.br;
  - Meu Imovel Rural.
- Endpoint interno `POST /api/geoquery/search`.
- Tabelas preparadas:
  - `geo_data_sources`;
  - `car_properties`;
  - `incra_properties`;
  - `geo_alert_layers`;
  - `geo_thematic_layers`;
  - `property_searches`;
  - `property_search_results`;
  - `property_documents`.
- Migration `009_geoquery_car_incra_alerts.sql` tenta habilitar PostGIS e usa `geom_geojson` como fallback.
- Scripts preparatorios em `scripts/geo` para fluxo de importacao por GeoJSON/Drive/shapefile/DBF.
- GEOQUERY-2A adiciona leitura GeoJSON por streaming, preview com `--limit`/`--sample` e importador por lote `scripts/geo/import-geojson-to-supabase.ts`.
- GEOQUERY-3 adiciona cruzamento espacial CAR x SIGEF via PostGIS/RPC, regra padrao de 60% de sobreposicao CAR e integracao server-side com API oficial MapBiomas Alerta.
- Classificacao `CAR_ALERT_INTERSECTION` aceita bases MapBiomas `car_with_alerts_and_intersections`.
- MapBiomas Alerta usa `MAPBIOMAS_ALERT_TOKEN` ou `MAPBIOMAS_ALERT_EMAIL`/`MAPBIOMAS_ALERT_PASSWORD` somente no servidor.
- A tela operacional oculta buffers e sobreposicao minima, mantendo defaults internos: alertas proximos 500 m, SIGEF 60% e buffer SIGEF 0 m.
- Alertas MapBiomas vindos de `ruralProperty(carCode)` aparecem como fonte "API MapBiomas"; `alert(alertCode, carCode)` valida os dados do laudo.
- O endpoint `/api/geoquery/mapbiomas-alert/report` gera PDF interno "Laudo GeoGestao - Dados MapBiomas Alerta" quando a API nao fornece PDF oficial direto.
- Busca sem base importada retorna mensagem clara: "Base CAR ainda nao importada."
- O sistema nao consulta Drive em tempo real a cada busca e nao automatiza login gov.br.
- Relatorio inicial da busca usa impressao do navegador; PDF automatico fica para fase futura.
- Tabelas `properties` e `property_geometries`.
- Upload de arquivo KML/KMZ vinculado a cliente, imovel e servico/card tecnico.
- Conversao de KML/KMZ para GeoJSON no cliente.
- Arquivo original salvo no bucket privado `attachments`.
- GeoJSON salvo em `property_geometries`.
- Visualizacao interativa com Leaflet e OpenStreetMap.
- Popup do perimetro com:
  - nome do imovel;
  - cliente;
  - servico;
  - area;
  - matricula;
  - data da matricula;
  - CAR Estadual;
  - CAR Federal;
  - municipio/UF;
  - status do servico;
  - link para abrir o servico.
- Arquitetura preparada para camada de satelite futura via provedor adequado.

Status da Fase GEOQUERY-1: parcial/implementada no codigo. Pendente aplicar `supabase/migrations/009_geoquery_car_incra_alerts.sql` no Supabase de teste, importar uma base CAR pequena, validar busca real com GeoJSON e depois avaliar aplicacao no Supabase oficial.

Status da Fase GEOQUERY-3: parcial/implementada no codigo. Pendente aplicar `supabase/migrations/010_geoquery_spatial_matching_mapbiomas.sql` no Supabase de teste, executar `select * from public.refresh_geoquery_geometries(true);`, validar CAR x SIGEF com base real e configurar credenciais MapBiomas quando quiser consultar laudos.

Status legado da Fase 7: parcial. Upload KML/KMZ permanece no codigo; ainda depende de aplicar a migration `006_map_properties_geometries.sql` no Supabase real e testar com um KML/KMZ simples.

### Contratos

- Modulo basico criado na Fase 1.
- Rota `/contratos`.
- Filtro por periodo em Contratos.
- Contrato vinculado a cliente, proposta e opcionalmente servico.
- Status iniciais de contrato modelados.
- Criacao/reaproveitamento automatico no fluxo de conversao.
- Rota `/contratos/[id]` com detalhe proprio, atalhos para proposta/servico/cliente, preview A4 e wizard de contrato.
- Wizard de contrato com etapas Registro, Demanda, Prazos, Financeiro, Clausulas, Assinaturas e Modelo.
- PDF real de contrato em Storage ficou preparado por campos e attachments; nesta fase existe preview A4 com imprimir/salvar como PDF.

### Filtros por periodo e Dashboard

- Componente reutilizavel de filtro por periodo criado para Dashboard, Propostas, Contratos, Servicos/Projetos e Financeiro.
- Presets: hoje, ultimos 7 dias, ultimos 30 dias, ultimos 3 meses, ultimos 12 meses, este mes, mes ate a data, trimestre ate a data, ano ate a data, tudo e personalizado.
- Filtro persiste por query params `period`, `from` e `to`.
- Dashboard principal passou a mostrar indicadores por periodo para propostas, contratos, receitas, despesas, lucro estimado e projetos.

Status da Fase UX-2: parcial/implementada no codigo. Pendente aplicar `supabase/migrations/007_ux2_proposals_contracts_documents.sql` no Supabase de teste, validar manualmente e depois avaliar aplicacao no Supabase oficial. Geracao real de PDF em arquivo ainda esta preparada, mas a entrega funcional atual usa preview A4 e imprimir/salvar como PDF.

### Qualidade e testes automatizados

- Fase QA-1 criada como fase tecnica, sem novas funcionalidades de produto.
- Scripts adicionados:
  - `npm run test`;
  - `npm run test:watch`;
  - `npm run test:coverage`;
  - `npm run test:e2e`;
  - `npm run test:e2e:ui`;
  - `npm run test:e2e:report`.
- Vitest configurado em `vitest.config.ts`.
- Playwright configurado em `playwright.config.ts`.
- Setup de teste criado em `src/test/setup.ts`.
- Estrutura criada:
  - `tests/unit`;
  - `tests/integration`;
  - `tests/e2e`;
  - `tests/helpers`;
  - `src/lib/services`.
- Services puros criados para regras de propostas, contratos, cards tecnicos e financeiro.
- Testes unitarios cobrem schemas Zod e utilitarios.
- Testes de integracao cobrem regras puras do fluxo proposta -> contrato -> servico -> financeiro.
- E2E inicial cobre a pagina de login.
- E2E autenticado e E2E com escrita no banco estao preparados, mas condicionais a variaveis de ambiente e banco Supabase de teste.
- GitHub Actions criado em `.github/workflows/ci.yml` para typecheck, build e Vitest em push/pull request.
- Job E2E no CI fica manual via `workflow_dispatch` e depende de secrets.

Status da Fase QA-1: parcial. Infraestrutura criada e validada localmente com `typecheck`, `test` e `test:e2e` basico; ainda falta rodar E2E autenticado/destrutivo em projeto Supabase dedicado a testes e confirmar secrets no GitHub.

## Migrations existentes

### `supabase/migrations/001_initial_schema.sql`

Cria a base inicial:

- `profiles`
- `clients`
- `client_interactions`
- `proposals`
- `service_boards`
- `service_columns`
- `service_cards`
- `service_card_movements`
- `checklists`
- `checklist_items`
- `attachments`
- `revenues`
- `expenses`
- `document_templates`
- `legislation_items`
- `audit_logs`
- RLS basica
- Politicas para usuarios autenticados
- Bucket/politicas de storage para anexos

### `supabase/migrations/002_contracts_conversion_flow.sql`

Adiciona a Fase 1:

- tabela `contracts`
- coluna `service_type` em `proposals`
- vinculos `proposal_id` e `contract_id` em `service_cards`
- vinculo `contract_id` em `revenues`
- indices para idempotencia do fluxo de conversao
- RLS para contratos
- suporte a `contract` em `attachments.entity_type`

### `supabase/migrations/003_phase1_repair_contracts_conversion_flow.sql`

Migration segura de reparo para banco real quando a 002 falhou ou quando ja existem dados parciais/duplicados:

- cria `contracts`, se ainda nao existir;
- adiciona e preenche `proposals.service_type`;
- normaliza contratos, cards e receitas duplicados antes dos indices unicos;
- cria indices de idempotencia;
- recria policy RLS de contratos;
- recarrega schema cache do Supabase/PostgREST com `notify pgrst, 'reload schema';`.

### `supabase/migrations/004_phase1_payment_and_service_repair.sql`

Migration segura para a regra atual da Fase 1:

- padroniza `proposals.service_type` em `georreferenciamento`, `car`, `itr_ccir` e `outros_servicos`;
- adiciona `proposals.payment_status`, `converted_at`, `contract_id` e `service_card_id`;
- adiciona `service_cards.service_type` e `service_cards.payment_status`;
- adiciona `revenues.auto_generated`;
- remove receitas automaticas pendentes criadas pela regra antiga de conversao;
- cria indices de idempotencia para contrato, service card e receita automatica;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/005_company_area.sql`

Adiciona a Fase 2:

- tabela `company_settings` para informacoes cadastrais da empresa;
- tabela `company_services` para nichos e servicos oferecidos;
- triggers de `updated_at`;
- RLS habilitado;
- policies CRUD para usuarios autenticados;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/006_map_properties_geometries.sql`

Adiciona a Fase 7:

- tabela `properties` para imoveis;
- tabela `property_geometries` para KML/KMZ, GeoJSON e vinculos;
- vinculos com cliente e service card;
- triggers de `updated_at`;
- RLS habilitado;
- policies CRUD para usuarios autenticados;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/007_ux2_proposals_contracts_documents.sql`

Adiciona a Fase UX-2:

- metadados JSON e campos de PDF em `proposals`;
- metadados JSON, clausulas, assinaturas, foro, status de pagamento e campos de PDF em `contracts`;
- categoria em `attachments`;
- tabelas auxiliares `proposal_services`, `contract_services` e `payment_installments`;
- indices para filtros por periodo e consultas de documentos;
- RLS e policies para usuarios autenticados nas novas tabelas;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/008_account1_organizations_profiles_ai.sql`

Adiciona a Fase ACCOUNT-1:

- tabelas `plans`, `organizations` e `organization_members`;
- planos iniciais Gratuito e Premium basico;
- campos de perfil para conta pessoal, avatar e preferencias;
- `organization_id` em tabelas principais para isolamento progressivo;
- metadados de armazenamento em `attachments`;
- backfill seguro para criar organizacao de perfis existentes;
- RLS e policies das novas tabelas;
- funcao `is_organization_member`;
- atualizacao da trigger `handle_new_user` para criar organizacao e membro owner;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/009_geoquery_car_incra_alerts.sql`

Adiciona a Fase GEOQUERY-1:

- tenta habilitar PostGIS com fallback para `geom_geojson`;
- cria catalogo `geo_data_sources`;
- cria tabelas de CAR, INCRA/SIGEF, alertas e camadas tematicas;
- cria historico de buscas e resultados;
- cria tabela `property_documents` para demonstrativo CAR, CAR atualizado, shapefiles e relatorios;
- cria indices por codigo CAR, SIGEF/CNIR, tipo de camada, organizacao e geometrias quando PostGIS existe;
- cria RLS para usuarios autenticados acessarem dados globais ou da propria organizacao;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/010_geoquery_spatial_matching_mapbiomas.sql`

Adiciona a Fase GEOQUERY-3:

- garante PostGIS;
- adiciona/garante colunas `geom` nas tabelas geograficas;
- cria indices GiST;
- cria `geojson_to_geom`;
- cria `refresh_geoquery_geometries`;
- cria `find_sigef_matches_by_car`;
- adiciona campos normalizados de alerta MapBiomas em `geo_alert_layers`;
- faz backfill desses campos a partir de `attributes`;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/015_ux_org_services_center.sql`

Adiciona a FASE UX-ORG-SERVICES-1:

- `organizations.slug`;
- organizacao `Terras Reunidas` com slug `terras-reunidas`;
- tabelas `service_members` e `service_events`;
- policies de RLS para membros da organizacao;
- colunas novas/ordenadas do quadro de Georreferenciamento;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/016_services_workflow_company_team_permissions.sql`

Correcao da FASE UX-ORG-SERVICES-1:

- garante fluxos iniciais por tipo de servico:
  - Georreferenciamento;
  - CAR;
  - ITR/CCIR;
  - Outros Servicos;
- cria `public.is_organization_manager`;
- adiciona dados bancarios em `company_settings`;
- cria `team_members` e `recurring_expenses`;
- adiciona vinculo de despesas com membro/recorrencia;
- restringe edicao de Minha Empresa para owner/admin;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/017_org_members_rls_service_lost_finance.sql`

Correcao da FASE UX-ORG-SERVICES-1:

- cria `public.is_org_member` e `public.is_org_owner_or_admin` com `SECURITY DEFINER`;
- recria policies de `organization_members` sem consulta recursiva na propria policy;
- restringe edicao de Minha Empresa, equipe e recorrencias a owner/admin;
- adiciona `Servico perdido` aos fluxos de Georreferenciamento, CAR, ITR/CCIR e Outros Servicos;
- cria indice de apoio para receitas automaticas por `service_card_id`;
- recarrega schema cache do Supabase/PostgREST.

### `supabase/migrations/018_company_owner_only_permissions.sql`

Correcao de permissao da FASE UX-ORG-SERVICES-1:

- cria `public.is_org_owner`;
- restringe edicao de Minha Empresa, Equipe, Variaveis financeiras, dados bancarios e regras da empresa a `role = owner`;
- permite leitura dessas areas para `owner` e `admin` ativos;
- vincula `flavio.terras@gmail.com` como owner da Terras Reunidas quando existir no Auth;
- vincula `nataliasilva.terras@gmail.com` e `romeu@teste.com.br` como admins operacionais quando existirem no Auth;
- recarrega schema cache do Supabase/PostgREST.

## Tipos principais

O arquivo `src/types/database.ts` concentra os tipos TypeScript principais, incluindo:

- `Profile`
- `Client`
- `CompanySettings`
- `CompanyService`
- `Property`
- `PropertyGeometry`
- `GeoDataSource`
- `CarProperty`
- `IncraProperty`
- `GeoAlertLayer`
- `GeoThematicLayer`
- `PropertySearch`
- `PropertySearchResult`
- `PropertyDocument`
- `ClientInteraction`
- `Proposal`
- `ProposalServiceType`
- `PaymentStatus`
- `ServiceBoard`
- `ServiceColumn`
- `ServiceCard`
- `Checklist`
- `ChecklistItem`
- `Attachment`
- `Revenue`
- `Expense`
- `DocumentTemplate`
- `LegislationItem`
- `AuditLog`
- `Contract`
- `ContractStatus`

## Funcionalidades ja testadas pelo usuario

- App abriu em `localhost`.
- Supabase conectado via `.env.local`.
- Login funcionando.
- Dashboard visivel.
- Clientes visiveis.
- Propostas visiveis.
- Servicos visiveis.
- Dados seedados disponiveis.
- Em 2026-05-04, o teste manual da Fase 1 encontrou erro de schema cache em `public.contracts`; a causa esperada e migration da Fase 1 nao aplicada com sucesso no Supabase real apos falha por duplicidade.
- Em 2026-05-05, a Fase 7 foi implementada no codigo. Pendencia: aplicar a migration `006_map_properties_geometries.sql` no Supabase real antes de testar `/mapa`.
- Em 2026-05-07, a Fase QA-1 foi criada com Vitest, Playwright, services puros, testes iniciais, documentacao e CI.

## Problemas conhecidos

- O comando `git` esta disponivel neste ambiente, mas nenhum commit deve ser feito automaticamente.
- A migration `004_phase1_payment_and_service_repair.sql` precisa ser aplicada no Supabase real antes de validar novamente o fluxo completo de conversao, pagamento e retorno.
- A migration `006_map_properties_geometries.sql` precisa ser aplicada no Supabase real antes de usar a aba Mapa.
- Os testes E2E autenticados dependem de `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` e de usuario criado no Supabase Auth.
- Os testes E2E que escrevem no banco dependem de `E2E_RUN_MUTATION_TESTS=true` e devem rodar apenas em banco de teste.
- A migration `008_account1_organizations_profiles_ai.sql` precisa ser aplicada no Supabase de teste antes de validar `/minha-conta`, Chat IA com contexto e filtros por `organization_id`.
- `OPENAI_API_KEY` deve existir apenas no ambiente do servidor. Sem ela, o chat retorna mensagem de configuracao ausente.
- O CI precisa de secrets `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` para validar build/E2E em ambiente GitHub quando necessario.
- O mapa usa OpenStreetMap; camada de satelite ainda e futura e depende de provedor/API apropriado.
- O upload KML/KMZ foi preparado para arquivos simples com geometrias suportadas por KML/GeoJSON; arquivos complexos devem ser testados caso a caso.
- Em PowerShell, `npm.ps1` pode ser bloqueado por politica de execucao; `npm.cmd` funciona como alternativa.
- Botoes e telas futuras devem ser marcados como "em breve" ou ocultos quando ainda nao houver implementacao real.

## Ultimas decisoes de produto

- O sistema e direcionado a escritorio de agrimensura.
- Undesk pode servir como referencia de UX, mas sem copiar marca, logo, nomes protegidos ou layout identico.
- O fluxo central desejado e: Proposta -> Contrato -> Servico -> Financeiro.
- O Kanban tecnico deve continuar sendo parte central do produto.
- A area "Minha Empresa" existe e concentra informacoes da empresa, clientes e servicos/nichos basicos.
- O sistema deve evoluir para documentos por cliente/imovel.
- Existe area de mapa com upload KML/KMZ, GeoJSON e visualizacao de perimetros.
- Supabase Auth, Database e Storage permanecem como fundacao.
- Chaves secretas nunca devem ser expostas.
- `.env.local` nao deve ser commitado.

## Proximos passos planejados

1. Aplicar a migration `006_map_properties_geometries.sql` no Supabase real.
2. Testar manualmente a Fase 7:
   - abrir `/mapa`;
   - enviar KML/KMZ simples;
   - verificar perimetro no mapa;
   - clicar no perimetro e conferir dados do projeto;
   - abrir servico vinculado pelo popup.
3. Criar usuario/projeto Supabase dedicado para E2E e rodar os testes autenticados da Fase QA-1.
4. Configurar secrets no GitHub Actions para build/E2E quando desejado.
5. Aplicar a migration `008_account1_organizations_profiles_ai.sql` no Supabase de teste.
6. Validar manualmente `/minha-conta`, Minha Empresa vinculada a organizacao, upload de avatar/anexos e Chat IA.
7. Evoluir o wizard de propostas ate pre-visualizacao e geracao de PDF.
8. Preparar documentos de cliente/imovel.
9. Evoluir dashboard gerencial.
10. Adicionar camada de satelite ao mapa via provedor com API adequada.
