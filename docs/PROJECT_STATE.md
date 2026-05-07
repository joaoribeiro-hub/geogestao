# GeoGestao - Estado Atual do Projeto

Data do checkpoint: 2026-05-07

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
```

Observacoes:

- A variavel recomendada para projetos Supabase novos e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` permanece como fallback de compatibilidade.
- Nenhuma `service_role key` deve ser usada ou exposta no frontend.
- `.env.local` deve permanecer fora do Git.
- `.env.local` esta listado no `.gitignore`.
- `E2E_TEST_EMAIL` e `E2E_TEST_PASSWORD` sao opcionais e devem apontar para usuario de teste.
- `E2E_RUN_MUTATION_TESTS=true` deve ser usado apenas em Supabase dedicado a testes.

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
- `/mapa` - mapa de imoveis/projetos com KML/KMZ e perimetros.
- `/clientes` - lista e busca de clientes.
- `/clientes/[id]` - detalhe de cliente.
- `/propostas` - dashboard comercial, criacao de propostas e Kanban de propostas.
- `/servicos` - quadros e cards de servicos tecnicos.
- `/servicos/[id]` - detalhe de card/servico tecnico.
- `/financeiro` - receitas, despesas e resumos basicos.
- `/documentos` - biblioteca de modelos/documentos.
- `/legislacao` - biblioteca de legislacao/normas.
- `/anexos` - listagem/envio de anexos.
- `/contratos` - modulo basico de contratos.

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

### Propostas

- Kanban com colunas comerciais.
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
- Cards com cliente, titulo, descricao, valor e responsavel.
- Drag and drop com persistencia.
- Campo obrigatorio de tipo de servico: Georreferenciamento, CAR, ITR/CCIR ou Outros Servicos.
- Criacao de proposta atualiza a tela e mostra feedback visual.
- Fluxo de conversao de proposta em servico foi ajustado na Fase 1.
- Arrastar para "Propostas em Execucao" dispara o mesmo fluxo de conversao do botao.
- Conversao cria/reaproveita contrato e card tecnico, mas nao cria receita automaticamente.
- Botao "Pagamento efetuado" cria/reaproveita uma receita paga e atualiza status de pagamento.
- Botao "Voltar" retorna a proposta para "Propostas Enviadas" e remove o servico/receita automatica.

### Servicos tecnicos

- Estrutura flexivel de quadros, colunas e cards.
- Quadros seedados para Geo, CAR, ITR/CCIR e Outros Servicos.
- Kanban tecnico com cards arrastaveis.
- Historico simples de movimentacao previsto.
- Checklists por card.

### Financeiro

- Receitas.
- Despesas.
- Status pendente, pago e vencido.
- Resumos basicos.
- Regra atual da Fase 1: receita automatica so e criada quando o usuario clica em "Pagamento efetuado".

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

### Mapa

- Rota `/mapa`.
- Item "Mapa" no menu lateral.
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

Status da Fase 7: parcial. Implementada no codigo e validada por typecheck, lint e build; ainda depende de aplicar a migration `006_map_properties_geometries.sql` no Supabase real e testar com um KML/KMZ simples.

### Contratos

- Modulo basico criado na Fase 1.
- Rota `/contratos`.
- Contrato vinculado a cliente, proposta e opcionalmente servico.
- Status iniciais de contrato modelados.
- Criacao/reaproveitamento automatico no fluxo de conversao.

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

## Tipos principais

O arquivo `src/types/database.ts` concentra os tipos TypeScript principais, incluindo:

- `Profile`
- `Client`
- `CompanySettings`
- `CompanyService`
- `Property`
- `PropertyGeometry`
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
5. Evoluir o wizard de propostas ate pre-visualizacao e geracao de PDF.
6. Preparar documentos de cliente/imovel.
7. Evoluir dashboard gerencial.
8. Adicionar camada de satelite ao mapa via provedor com API adequada.
