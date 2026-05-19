# GeoGestao - Testes Automatizados

Data do checkpoint: 2026-05-07

## Objetivo

A Fase QA-1 cria uma base de testes automatizados para reduzir regressao nos fluxos criticos do GeoGestao:

- Clientes;
- Propostas;
- Contratos;
- Servicos tecnicos;
- Financeiro;
- Mapa KML/KMZ.

Esta fase nao adiciona funcionalidade nova de produto. O foco e infraestrutura, services testaveis, testes iniciais, CI e documentacao.

## Camadas de teste

### Unidade e regras puras

Ferramenta: Vitest.

Local:

```text
tests/unit
tests/integration
src/lib/services
src/test/setup.ts
```

Cobertura inicial:

- validacoes Zod principais;
- utilitarios de formatacao/conversao;
- regras puras do fluxo proposta -> contrato -> servico -> financeiro;
- idempotencia por payload de contrato, card tecnico e receita automatica;
- reset do fluxo de voltar proposta/servico.
- filtros por periodo usados por Dashboard, Propostas, Contratos, Servicos/Projetos e Financeiro;
- regras UX-2 de status comercial, valor perdido e pagamento pago/nao pago.
- ACCOUNT-1: calculo de armazenamento usado, limite de quota, validacao de perfil, input do Chat IA e extracao segura de texto da resposta OpenAI.
- GEOQUERY-1: validacao/normalizacao do CAR Federal, normalizacao de campos DBF, aliases CAR/INCRA e classificacao de camadas.
- GEOQUERY-2A: leitura streaming de GeoJSON FeatureCollection e mapeamento de preview/importacao com fixture pequena.
- GEOQUERY-3: regra de sobreposicao SIGEF/CAR, mapeamento `CAR_ALERT_INTERSECTION`, service MapBiomas Alerta com `fetch` mockado, fallback de token para `signIn`, resposta `alert = null` e PDF interno do laudo MapBiomas.

### Integracao de regras criticas

As regras extraidas para `src/lib/services` mantem a action existente mais testavel sem reescrever o app inteiro:

- `src/lib/services/proposals.ts`;
- `src/lib/services/contracts.ts`;
- `src/lib/services/service-cards.ts`;
- `src/lib/services/finance.ts`.

Os testes de `tests/integration` ainda nao acessam o Supabase real. Eles validam a regra de negocio pura que as server actions usam para montar inserts/updates. Testes de banco real ficam para uma fase posterior com Supabase local ou projeto Supabase dedicado.

### E2E

Ferramenta: Playwright.

Local:

```text
tests/e2e
playwright.config.ts
```

Cobertura inicial:

- pagina de login carrega;
- dashboard apos login, quando `E2E_TEST_EMAIL` e `E2E_TEST_PASSWORD` forem definidos;
- rota `/mapa` carrega apos login, quando credenciais forem definidas;
- rota `/mapa` valida a tela "Fazer busca de imovel", campo CAR e links oficiais;
- rota `/minha-conta` carrega apos login, quando credenciais forem definidas;
- menu lateral mostra secoes MENU e CONFIGURACOES;
- Chat IA abre no app autenticado e, sem `OPENAI_API_KEY`, mostra mensagem de configuracao ausente;
- fluxo completo com escrita no banco fica preparado e bloqueado por seguranca ate `E2E_RUN_MUTATION_TESTS=true`.
- O fluxo destrutivo UX-2 cria proposta, altera status para aprovado, verifica contrato/servico, marca pagamento como nao pago, valida receita a receber, marca pagamento como pago, valida receita recebida e abre a visualizacao da proposta.

O helper de login comeca explicitamente em `/login`, aguarda o formulario client-side estar hidratado (`data-e2e-ready="true"`), preenche as credenciais de teste, confirma que os campos receberam os valores esperados e valida que o layout autenticado (`app-shell`) ficou disponivel apos o redirecionamento. Testes de paginas autenticadas devem navegar explicitamente para a rota que desejam validar e usar seletores estaveis, como `dashboard-title` e `map-title`.

Durante o login, o Playwright observa a chamada do Supabase Auth para `/auth/v1/token`. Se a autenticacao falhar, a mensagem de erro mostra apenas dados seguros:

- URL atual;
- host de `NEXT_PUBLIC_SUPABASE_URL`;
- se o formulario de login estava hidratado;
- se continuou em `/login`;
- se `login-error` apareceu;
- host/status da resposta Supabase Auth;
- mensagem textual de erro do Auth, quando houver;
- se `app-shell` apareceu;
- screenshot anexado ao relatorio.

Senha, tokens e chaves publicas completas nao sao impressos.

O Playwright sobe o Next.js em `http://127.0.0.1:3100`, usando:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
```

O E2E nao reutiliza servidor existente. Isso evita testar acidentalmente contra um `localhost:3000` manual apontando para outro Supabase.

## Comandos

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:report
```

Validacoes gerais:

```bash
npm run typecheck
npm run build
npm run test
```

## Como rodar localmente

1. Instale dependencias:

```bash
npm install
```

2. Instale o Chromium do Playwright na primeira execucao:

```bash
npx playwright install chromium
```

3. Rode testes unitarios e de regras:

```bash
npm run test
```

4. Rode coverage:

```bash
npm run test:coverage
```

O relatorio HTML fica em:

```text
coverage/index.html
```

5. Rode E2E basico:

```bash
npm run test:e2e
```

O relatorio HTML do Playwright fica em:

```text
playwright-report/index.html
```

Para abrir pelo Playwright:

```bash
npm run test:e2e:report
```

## Usuario de teste no Supabase

Para rodar testes autenticados:

1. Use um projeto Supabase separado para testes.
2. Aplique as migrations necessarias, incluindo:
   - `004_phase1_payment_and_service_repair.sql`;
   - `005_company_area.sql`, se quiser validar Minha Empresa;
   - `006_map_properties_geometries.sql`, se quiser validar Mapa.
   - `007_ux2_proposals_contracts_documents.sql`, para validar UX-2.
   - `008_account1_organizations_profiles_ai.sql`, para validar Minha Conta, organizacoes, planos, limite de armazenamento e Chat IA.
   - `009_geoquery_car_incra_alerts.sql`, para validar Fazer busca de imovel, bases CAR/INCRA/alertas e historico.
   - `010_geoquery_spatial_matching_mapbiomas.sql`, para validar cruzamento espacial CAR x SIGEF e alertas MapBiomas.
3. Crie um usuario no Supabase Auth.
4. Garanta um registro correspondente em `profiles`.
5. Configure variaveis locais:

```env
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` continua aceito como fallback de compatibilidade.

O Playwright carrega as variaveis do ambiente do shell e tambem os arquivos `.env*` pelo mesmo mecanismo do Next. Assim, para uso local, as variaveis opcionais de E2E podem ficar em `.env.local`, que continua ignorado pelo Git.

Quando a mesma maquina tem um `.env.local` apontando para o Supabase principal, os testes E2E devem ser rodados com as variaveis do Supabase de teste passadas pelo terminal ou pelo CI. Variaveis ja existentes no ambiente do processo tem prioridade sobre os valores carregados de `.env.local`, e o `webServer` do Playwright repassa esse ambiente para o `npm run dev` que ele inicia.

O usuario `qa@geogestao.test` deve existir apenas no Supabase de teste. Nao crie esse usuario no Supabase principal; se o login QA falhar no app manual, o mais provavel e o servidor local estar apontando para o Supabase principal.

Para testar manualmente com o usuario QA, suba o app com as variaveis do Supabase de teste no mesmo terminal:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto-de-teste.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica-de-teste"
$env:E2E_TEST_EMAIL="qa@geogestao.test"
$env:E2E_TEST_PASSWORD="senha-do-usuario-qa"
npm run dev
```

Se o projeto ainda usa anon key como fallback, use:

```powershell
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-anon-publica-de-teste"
```

Para rodar E2E autenticado e o fluxo com escrita no banco de teste:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto-de-teste.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica-de-teste"
$env:E2E_TEST_EMAIL="qa@geogestao.test"
$env:E2E_TEST_PASSWORD="senha-do-usuario-qa"
$env:E2E_RUN_MUTATION_TESTS="true"
npm run test:e2e
```

Nao grave senhas ou chaves reais em arquivos versionados.

`OPENAI_API_KEY` e opcional nos testes. Quando nao existir, o E2E valida o fallback "OPENAI_API_KEY nao configurada". Quando existir, o chat pode chamar a API real; por isso nao configure essa chave nos E2E se a intencao for testar apenas o fallback local.

O `npm run test:e2e` deve ser executado sem um servidor manual aberto na porta `3100`. O servidor manual na porta `3000` nao e usado pelo Playwright.

## Testes com escrita no banco

Os testes que criam cliente, proposta, contrato, card tecnico e receita existem, mas so rodam quando:

```env
E2E_RUN_MUTATION_TESTS=true
```

Use essa opcao apenas em banco de teste. Nao rode esses testes contra producao ou contra um banco real de trabalho sem backup, porque eles criam dados com prefixo `Cliente QA` e `Proposta QA`.

## Workflow manual de E2E destrutivo

O workflow `.github/workflows/e2e-mutation.yml` roda os testes Playwright com escrita no banco somente por acionamento manual (`workflow_dispatch`). Ele nao roda em `push` nem em `pull_request`.

Use esse workflow apenas com um projeto Supabase separado para testes. Nunca configure esses secrets com o Supabase principal ou de producao, porque o fluxo E2E pode criar dados QA, como `Cliente QA` e `Proposta QA`.

Configure em GitHub > Settings > Secrets and variables > Actions > Secrets:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
E2E_TEST_EMAIL
E2E_TEST_PASSWORD
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` existe por compatibilidade. Se o app estiver usando somente `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, mantenha a anon key alinhada ao mesmo projeto de teste ou deixe sem valor quando isso for aceito pela configuracao do repositorio.

Configure em GitHub > Settings > Secrets and variables > Actions > Variables:

```text
E2E_RUN_MUTATION_TESTS=true
```

Para executar manualmente:

1. Abra a aba Actions do GitHub.
2. Selecione `E2E Mutation Tests`.
3. Clique em `Run workflow`.
4. Escolha a branch desejada.
5. Confirme a execucao.

O workflow executa:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

Se `E2E_RUN_MUTATION_TESTS` nao estiver como `true`, o workflow falha antes de rodar os testes destrutivos. Isso evita execucoes acidentais com configuracao incompleta.

## Como interpretar falhas

- Falha de Vitest em schema: regra de validacao mudou ou payload de formulario mudou.
- Falha de service puro: risco de regressao em contrato, card tecnico, pagamento ou retorno.
- Falha de Playwright antes do login: app nao subiu, rota publica quebrou ou navegador nao foi instalado.
- Falha de Playwright no `app-shell`: credenciais invalidas, sessao nao criada, formulario ainda nao hidratado, middleware bloqueando autenticacao ou app apontando para Supabase diferente daquele onde o usuario QA existe. O erro do helper de login informa a URL atual, host Supabase configurado, status da resposta `/auth/v1/token`, se continuou em `/login`, se houve erro de credenciais, se o `app-shell` apareceu e anexa um screenshot ao relatorio.
- Falha de Playwright apos navegar para uma rota autenticada: migrations ausentes, RLS/policies ou mudanca de UI sem seletor estavel.
- Falha em `/minha-conta`: normalmente indica que a migration ACCOUNT-1 ainda nao foi aplicada, pois a tela depende de `profiles.organization_id`, `organizations`, `plans` e novos metadados de `attachments`.
- Falha em `/mapa`/GeoQuery: normalmente indica que as migrations 008 e 009 ainda nao foram aplicadas, pois a tela consulta `organization_id`, `geo_data_sources` e `property_searches`.
- Falha no SIGEF por sobreposicao: normalmente indica que a migration 010 nao foi aplicada, PostGIS nao esta habilitado ou `refresh_geoquery_geometries(true)` ainda nao foi executada.
- Falha no botao "Visualizar laudo": verifique variaveis server-side `MAPBIOMAS_ALERT_TOKEN` ou `MAPBIOMAS_ALERT_EMAIL`/`MAPBIOMAS_ALERT_PASSWORD`.
- Falha do Chat IA sem chave: o esperado e exibir "OPENAI_API_KEY nao configurada no servidor.". Se aparecer 401, a sessao autenticada nao foi criada.

## Como adicionar novo teste

1. Para validacao simples, crie um arquivo em `tests/unit`.
2. Para regra de fluxo, extraia a regra minima para `src/lib/services` e teste em `tests/integration`.
3. Para fluxo de tela, adicione `data-testid` estavel e teste em `tests/e2e`.
4. Evite depender de texto que pode mudar por UX quando um seletor estavel fizer mais sentido.
5. Se o teste escrever no banco, use prefixo `QA` e proteja por `E2E_RUN_MUTATION_TESTS=true`.

## Status de cobertura

Coberto agora:

- validacoes Zod de cliente, proposta, financeiro e mapa;
- utilitarios `toNumber`, `formatCurrency` e `formatDate`;
- regras puras de conversao proposta -> contrato -> servico;
- criacao/reaproveitamento logico de card tecnico;
- criacao/reaproveitamento logico de receita automatica paga;
- voltar proposta/servico em nivel de payload;
- filtros por periodo;
- armazenamento/limite de plano da ACCOUNT-1;
- validacao de perfil e Chat IA;
- validacao/normalizacao GeoQuery, campos DBF e classificacao de bases geograficas;
- leitura streaming de GeoJSON pequeno em fixture para proteger o importador de regressao basica;
- service MapBiomas Alerta com mock de `fetch`, sem chamada real a API;
- PDF interno "Laudo GeoGestao - Dados MapBiomas Alerta";
- ocultacao dos controles tecnicos da tela operacional GeoQuery;
- UX-ORG-SERVICES-1: regras puras do fluxo de Servicos, incluindo coluna inicial `Aguardando documentos`, destino de prioridade alta, botao Proximo, checklists padrao por tipo e resumo automatico sem IA.
- UX-ORG-SERVICES-1 correcao: colunas por tipo de servico, permissao owner/admin de Minha Empresa, path de storage por organizacao e regra de despesa mensal de membro de equipe.
- UX-ORG-SERVICES-1 correcao RLS/financeiro: migration sem policy recursiva em `organization_members`, parser BRL de valores de servico, lucro estimado/efetuado/perdido e coluna `Servico perdido`.
- status comercial de proposta nao aprovada/perdida;
- receita pendente/a receber para pagamento nao pago;
- pagina de login em E2E.
- rota Minha Conta, secoes do menu e abertura do Chat IA em E2E autenticado, quando credenciais existem.
- tela Fazer busca de imovel em E2E autenticado, quando credenciais existem.

Pendente:

- testes com Supabase local ou banco dedicado;
- E2E autenticado rodando com secrets configurados;
- E2E destrutivo com `E2E_RUN_MUTATION_TESTS=true` em ambiente de teste;
- E2E destrutivo UX-2 no workflow manual depois de configurar secrets/variable no GitHub;
- cobertura de upload real KML/KMZ no Storage;
- testes de RLS/policies;
- testes de contratos e financeiro diretamente no banco;
- E2E de upload real de avatar/anexo com verificacao de quota no Supabase de teste;
- teste automatizado de chamada real OpenAI, caso seja desejado em ambiente isolado.
- teste de importacao real de shapefile/GeoJSON em Supabase de teste;
- teste de intersecao espacial/buffer depois de ativar PostGIS e carregar fixtures geograficas.
- E2E completo do novo fluxo de Servicos com anexos, criacao de cliente pelo servico, proposta/contrato vinculados e reset seguro em Supabase de teste.
