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
- fluxo completo com escrita no banco fica preparado e bloqueado por seguranca ate `E2E_RUN_MUTATION_TESTS=true`.

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
3. Crie um usuario no Supabase Auth.
4. Garanta um registro correspondente em `profiles`.
5. Configure variaveis locais:

```env
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` continua aceito como fallback de compatibilidade.

## Testes com escrita no banco

Os testes que criam cliente, proposta, contrato, card tecnico e receita existem, mas so rodam quando:

```env
E2E_RUN_MUTATION_TESTS=true
```

Use essa opcao apenas em banco de teste. Nao rode esses testes contra producao ou contra um banco real de trabalho sem backup, porque eles criam dados com prefixo `Cliente QA` e `Proposta QA`.

## Como interpretar falhas

- Falha de Vitest em schema: regra de validacao mudou ou payload de formulario mudou.
- Falha de service puro: risco de regressao em contrato, card tecnico, pagamento ou retorno.
- Falha de Playwright antes do login: app nao subiu, rota publica quebrou ou navegador nao foi instalado.
- Falha de Playwright apos login: credenciais invalidas, migrations ausentes, RLS/policies ou mudanca de UI sem seletor estavel.

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
- pagina de login em E2E.

Pendente:

- testes com Supabase local ou banco dedicado;
- E2E autenticado rodando com secrets configurados;
- E2E destrutivo com `E2E_RUN_MUTATION_TESTS=true` em ambiente de teste;
- cobertura de upload real KML/KMZ no Storage;
- testes de RLS/policies;
- testes de contratos e financeiro diretamente no banco.
