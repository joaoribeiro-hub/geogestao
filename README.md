# GeoGestao MVP

Sistema web para gestao de escritorio de agrimensura com CRM, propostas em Kanban, servicos tecnicos, financeiro basico, documentos, legislacao e anexos privados.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth, PostgreSQL e Storage
- dnd-kit
- Zod
- React Hook Form
- Leaflet
- OpenStreetMap
- @tmcw/togeojson
- JSZip
- Vitest
- Playwright

## Como rodar

1. Instale dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

3. Configure `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica-opcional
OPENAI_API_KEY=sua-chave-server-side-opcional
OPENAI_MODEL=gpt-5.5
```

Use apenas a publishable key ou anon key no frontend. Nao coloque service role key no `.env.local` usado pelo Next.js.
`OPENAI_API_KEY` e somente server-side. Nunca crie `NEXT_PUBLIC_OPENAI_API_KEY`. Em producao, configure essa variavel como secret do ambiente do servidor.

4. Rode migrations e seed no Supabase.

Com Supabase CLI local:

```bash
supabase start
supabase db reset
```

Ou, em um projeto remoto, execute o SQL de:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_contracts_conversion_flow.sql`
- `supabase/migrations/003_phase1_repair_contracts_conversion_flow.sql` se a migration 002 falhou ou se o banco remoto ja tinha dados duplicados da Fase 1
- `supabase/migrations/004_phase1_payment_and_service_repair.sql` para a regra atual da Fase 1: converter cria contrato + servico, pagamento efetuado cria receita
- `supabase/migrations/005_company_area.sql` para a area Minha Empresa
- `supabase/migrations/006_map_properties_geometries.sql` para o mapa com imoveis e geometrias KML/KMZ
- `supabase/migrations/007_ux2_proposals_contracts_documents.sql` para UX-2: status comercial, documentos, wizards e metadados de PDF
- `supabase/migrations/008_account1_organizations_profiles_ai.sql` para ACCOUNT-1: Minha Conta, organizacoes, planos, quotas e Chat IA
- `supabase/migrations/009_geoquery_car_incra_alerts.sql` para GEOQUERY-1: busca de imovel por CAR Federal, CAR, INCRA, alertas e historico
- `supabase/seed.sql`

5. Crie ao menos um usuario no Supabase Auth.

No painel do Supabase, crie um usuario por e-mail e senha. A trigger `handle_new_user` cria automaticamente o registro em `profiles`. Para tornar esse usuario admin, atualize o role:

```sql
update public.profiles
set role = 'admin'
where id = '<USER_ID_DO_AUTH>';
```

6. Inicie o app:

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e
```

## Testes

A Fase QA-1 adiciona testes automatizados em camadas:

- Vitest para unidade e regras puras;
- Playwright para E2E;
- GitHub Actions para typecheck, build e testes em push/pull request.

Comandos principais:

```bash
npm run test
npm run test:coverage
npm run test:e2e
```

Para E2E autenticado, configure um usuario de teste no Supabase e defina:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
```

O app manual usa as variaveis disponiveis quando `npm run dev` e iniciado. Se `.env.local` aponta para o Supabase principal, o usuario QA do Supabase de teste nao vai autenticar nesse servidor local. Para testar manualmente com QA, suba o app no terminal com as variaveis do Supabase de teste. Nao crie `qa@geogestao.test` no Supabase principal.

Fluxos E2E com escrita no banco so rodam com `E2E_RUN_MUTATION_TESTS=true` e devem ser usados apenas em projeto Supabase separado para testes. O Playwright repassa as variaveis do terminal/CI para o servidor que ele inicia. Veja detalhes em `docs/TESTING.md`.

O Playwright usa um servidor proprio em `http://127.0.0.1:3100` e nao reutiliza o servidor manual em `localhost:3000`. Isso evita rodar E2E contra um app aberto com `.env.local` apontando para o Supabase principal.

O workflow manual `.github/workflows/e2e-mutation.yml` roda os E2E destrutivos apenas pela aba Actions, com secrets apontando para o Supabase de teste e `E2E_RUN_MUTATION_TESTS=true`. Ele nao roda automaticamente em `push` ou `pull_request`.

## Estrutura principal

- `src/app/(auth)/login`: login com Supabase Auth.
- `src/app/(app)`: rotas autenticadas.
- `src/components/forms`: formularios com React Hook Form e Zod.
- `src/components/kanban`: Kanbans com dnd-kit.
- `src/components/ui`: componentes base no estilo shadcn/ui.
- `src/lib/supabase`: clientes Supabase server/browser e middleware.
- `src/lib/services`: regras puras testaveis de propostas, contratos, servicos e financeiro.
- `src/lib/schemas.ts`: validacoes Zod.
- `src/test`: setup do Vitest.
- `src/types/database.ts`: tipos TypeScript das entidades principais.
- `tests/unit`: testes unitarios.
- `tests/integration`: testes de regras criticas.
- `tests/e2e`: testes Playwright.
- `supabase/migrations`: schema, RLS, policies e storage.
- `supabase/seed.sql`: dados de exemplo.

## Modulos implementados

- Autenticacao protegida por middleware.
- `profiles` com roles: admin, gerente, tecnico, financeiro e leitura.
- Minha Empresa com informacoes da empresa, clientes espelhados e servicos/nichos basicos.
- Minha Conta com dados pessoais, avatar e preferencias.
- Base multiempresa com `organizations`, `organization_members`, `plans` e `organization_id`.
- Menu lateral dividido em MENU e CONFIGURACOES.
- Chat IA flutuante com chamada server-side para OpenAI e fallback quando `OPENAI_API_KEY` nao esta configurada.
- CRM com clientes PF/PJ, busca, detalhe, edicao, exclusao e historico de interacoes.
- Propostas comerciais com cards de resumo, grafico simples por status, criacao por PDF/modelo e Kanban com drag and drop persistente.
- Propostas possuem tipo de servico: `georreferenciamento`, `car`, `itr_ccir` ou `outros_servicos`.
- Contratos vinculados a cliente, proposta, servico e receita prevista.
- Servicos tecnicos com quadros, colunas, cards, historico de movimentacao e checklists.
- Anexos privados via Supabase Storage e tabela `attachments`.
- Financeiro basico com receitas, despesas, contas a receber/pagar, resumo mensal e resumo por projeto.
- Biblioteca de documentos com busca.
- Biblioteca de legislacao com busca por palavra-chave.
- Fazer busca de imovel em `/mapa`, com CAR Federal, bases CAR/INCRA/alertas preparadas, historico, links oficiais e mapa Leaflet/OpenStreetMap.
- Upload KML/KMZ manual continua disponivel dentro da tela de busca de imovel.
- Dashboard com indicadores, vencimentos e projetos atrasados.
- Filtros por periodo em Dashboard, Propostas, Contratos, Servicos/Projetos e Financeiro.

## Fluxo proposta -> contrato -> servico -> financeiro

Status da Fase 1: parcial ate a migration `004_phase1_payment_and_service_repair.sql` ser aplicada no Supabase real e o teste manual ser refeito.

Ao converter uma proposta em servico, o sistema:

- atualiza a proposta para `execution`;
- cria ou reaproveita um contrato vinculado a proposta;
- cria ou reaproveita um card tecnico no quadro definido pelo tipo de servico da proposta;
- coloca o card na primeira coluna ativa do quadro tecnico;
- vincula `client_id`, `proposal_id` e `contract_id` ao card tecnico;
- define `payment_status` como `pagamento_nao_efetuado`;
- registra eventos em `audit_logs`;
- evita duplicidade quando o usuario clica mais de uma vez.
- tambem executa a conversao quando a proposta e arrastada para `Propostas em Execucao`.

Converter em servico nao cria receita automaticamente.

Ao clicar em "Pagamento efetuado", o sistema:

- cria ou reaproveita uma unica receita automatica no Financeiro;
- grava a receita com `status = paid`;
- preenche `paid_at` com a data atual;
- vincula receita a cliente, proposta, contrato e card tecnico;
- atualiza proposta e card tecnico para `pagamento_efetuado`;
- evita duplicidade quando o usuario clica mais de uma vez.

Na Fase UX-2, a acao principal da UI de Propostas passou a ser status comercial:

- `Aprovado`: move para Propostas em Execucao e cria/reaproveita contrato e card tecnico;
- `Em espera`: move para Propostas em Negociacao;
- `Nao aprovado`: move para Propostas Perdidas e entra no indicador de valor perdido.

Propostas em execucao exibem controle financeiro:

- `Nao pago`: cria/reaproveita receita pendente em Contas a Receber;
- `Pago`: cria/reaproveita a mesma receita como recebida.

As rotas `/propostas/[id]` e `/contratos/[id]` exibem preview A4 e permitem imprimir/salvar como PDF. PDFs anexados continuam salvos no Storage privado e vinculados por `attachments`.

Antes de testar UX-2 em Supabase remoto, execute no SQL Editor:

```text
supabase/migrations/007_ux2_proposals_contracts_documents.sql
```

Execute primeiro no Supabase de teste. So depois de validar fluxo comercial, contratos, documentos e financeiro, avalie aplicar no Supabase oficial.

## Minha Conta, multiempresa e Chat IA

Antes de testar a Fase ACCOUNT-1 em Supabase remoto, execute no SQL Editor o conteudo completo de:

```text
supabase/migrations/008_account1_organizations_profiles_ai.sql
```

Execute primeiro no Supabase de teste. A migration cria `plans`, `organizations`, `organization_members`, vincula perfis existentes a uma organizacao e adiciona `organization_id` nas tabelas principais para isolamento progressivo.

Depois:

1. Acesse `/minha-conta`.
2. Edite nome, telefone, documento e preferencias.
3. Envie uma foto de perfil JPG, PNG ou WebP de ate 2 MB.
4. Acesse `/minha-empresa` e confirme que os dados da empresa ficam vinculados a organizacao atual.
5. Teste um upload em `/anexos` para validar o limite de armazenamento.
6. Abra o Chat IA no canto inferior direito.

Sem `OPENAI_API_KEY`, o chat mostra erro claro de configuracao. Com a chave configurada no servidor, o route handler `/api/ai/chat` usa o SDK oficial da OpenAI e a Responses API com texto, usando apenas contexto basico da organizacao logada. Nesta fase a IA nao altera banco.

Ao clicar em "Voltar" na proposta ou "Voltar servico" no card tecnico, o sistema:

- retorna a proposta para `Propostas Enviadas`;
- marca o contrato como `cancelado`;
- remove o card tecnico criado pela conversao;
- remove receitas automaticas vinculadas a proposta;
- volta `payment_status` para `pagamento_nao_efetuado`;
- registra `audit_logs`.

Para habilitar esse fluxo em um banco ja existente, execute a migration:

```sql
-- Supabase SQL Editor
-- conteudo de supabase/migrations/004_phase1_payment_and_service_repair.sql
```

Se aparecer `Could not find the table 'public.contracts' in the schema cache`, a migration da Fase 1 ainda nao foi aplicada com sucesso no Supabase real ou o PostgREST ainda nao recarregou o schema. A migration de reparo termina com `notify pgrst, 'reload schema';`.

## Fazer busca de imovel / GeoQuery

Antes de testar a Fase GEOQUERY-1 em Supabase remoto, execute no SQL Editor o conteudo completo de:

```text
supabase/migrations/008_account1_organizations_profiles_ai.sql
supabase/migrations/009_geoquery_car_incra_alerts.sql
```

Se a migration 008 ja foi aplicada, rode somente a 009. Execute primeiro no Supabase de teste.

A rota `/mapa` continua funcionando, mas o menu mostra "Fazer busca de imovel". A tela permite buscar pelo numero do CAR Federal, vincular cliente/servico/imovel, ver historico, abrir links oficiais do CAR/gov.br e renderizar GeoJSON no mapa quando a base ja estiver importada.

O Drive e apenas origem bruta dos arquivos. Baixe os arquivos da pasta configurada, converta shapefiles completos para GeoJSON e gere uma previa de importacao:

```bash
npx tsx scripts/geo/import-geojson.ts --file base.geojson --classification CAR_COMPLETA --limit 100 --output preview.json
```

Para importacao real em lote no Supabase de teste, use `SUPABASE_SERVICE_ROLE_KEY` somente no terminal local/admin:

```bash
npx tsx scripts/geo/import-geojson-to-supabase.ts --file base.geojson --classification CAR_COMPLETA --batch-size 100 --source-name "CAR teste" --provider SICAR
```

Variaveis opcionais para a origem bruta:

```env
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_APPLICATION_CREDENTIALS=
```

O GeoGestao nao automatiza login gov.br, nao armazena senha gov.br e nao burla captcha. Para demonstrativo CAR ou CAR atualizado, use os links oficiais, baixe o documento manualmente e anexe pelo fluxo de documentos/anexos. Detalhes em `docs/GEOQUERY.md`.

## Mapa com KML/KMZ

Antes de testar a aba Mapa em um Supabase real, execute no SQL Editor o conteudo completo de:

```text
supabase/migrations/006_map_properties_geometries.sql
```

Depois:

1. Acesse `/mapa`.
2. Selecione um cliente.
3. Opcionalmente vincule um servico/card tecnico.
4. Preencha nome do imovel, area, matricula, data da matricula, CAR Estadual, CAR Federal, municipio, UF e observacoes.
5. Envie um arquivo `.kml` simples ou `.kmz` com KML interno.
6. Confirme que o perimetro aparece no mapa.
7. Clique no perimetro e confira cliente, imovel, servico, area, matricula, CARs e link para abrir o servico.

O mapa usa Leaflet com OpenStreetMap como camada inicial. A arquitetura fica preparada para camada de satelite futura via provedor com API adequada. O KML/KMZ original e salvo no bucket privado `attachments`, e o GeoJSON derivado e salvo em `property_geometries`.

## Seguranca

- Todas as tabelas principais tem Row Level Security ativado.
- As policies iniciais liberam CRUD para usuarios autenticados, adequadas para MVP interno de ate 10 usuarios.
- O bucket `attachments` e privado.
- Uploads usam Supabase Storage com policies para usuarios autenticados.
- Inputs sao validados com Zod no cliente e no servidor.
- Actions importantes registram eventos em `audit_logs`.

## Proximas melhorias recomendadas

- Politicas por role para separar admin, gerente, tecnico, financeiro e leitura.
- Telas de administracao de usuarios e perfis.
- Edicao completa de propostas, documentos e legislacao.
- Comentarios estruturados em propostas e cards de servico.
- Evoluir o wizard de propostas ate pre-visualizacao e geracao de PDF.
- Documentos por cliente/imovel e categorias documentais.
- Dashboard avancado com filtros e graficos.
- Camada de satelite futura no mapa via provedor com API adequada.
- Testes automatizados de actions e fluxos criticos.
- Equipe, bancos, armazenamento e variaveis financeiras avancadas dentro de Minha Empresa.
