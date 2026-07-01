# Hub de Modulos

Fases: `MODULE-HUB-EXTERNAL-APPS-1`, `MODULE-HUB-MIGRATION-2`, `MODULE-HUB-REAL-PORT-1` e `BUSCAGEO-REAL-INTEGRATION-1`.

## Objetivo

O GeoGestao funciona como hub principal. O seletor no topo esquerdo lista os modulos internos sem sair do AppShell, mantendo login, empresa atual e isolamento por `organization_id`.

## Modulos no seletor

- GeoGestao Principal: `/inicio`, status ativo.
- MeuIMOVEL-CAR: `/modulos/meu-imovel-car`, status beta.
- BuscaGEO: `/modulos/buscageo`, status beta.
- Corretor RTK/PPP: `/modulos/corretor-rtk-ppp`, status beta.
- Gerador RW5: `/modulos/gerador-rw5`, status beta.
- App 2026-05-29: `/modulos/app-2026-05-29`, status indisponivel porque a pasta nao existe neste ambiente.

A rota duplicada `app-2026-06-25` nao aparece mais no seletor; o app real correspondente e o `Gerador RW5`.

## Banco

Migrations:

- `044_module_hub_external_apps.sql`: catalogo, habilitacao por organizacao, logs e `user_preferences`.
- `045_module_hub_migration_2.sql`: jobs iniciais de RTK/RW5 e tabelas de apoio MeuIMOVEL.
- `046_module_hub_real_port.sql`: complementa RW5, cria `module_buscageo_jobs`, `module_meu_imovel_queries` e `module_meu_imovel_alerts`.
- `047_buscageo_real_integration.sql`: completa BuscaGEO, bucket privado, statuses, RLS update e contrato do worker.

## Seguranca

- Jobs operacionais sempre usam `organization_id` e `user_id`.
- Arquivos seguem `organizations/{organization_id}/modules/{module_key}/{job_id}/...`.
- RLS das tabelas de modulo usa membership da organizacao.
- Nenhum modulo usa `service_role` no frontend.

## Status Real

- Corretor RTK/PPP: funcional em TypeScript/Next, com parser, delta, preview, resultado e download.
- Gerador RW5: beta funcional, com parser/normalizador portado dos layouts MC, PTS, exportacao 37 colunas e legado; gera RW5 com blocos de base, GPS e metricas.
- BuscaGEO: beta com tela operacional, jobs persistidos, Storage privado, worker FastAPI/GDAL e callback protegido.
- MeuIMOVEL-CAR: busca inicial real sobre bases GeoQuery/propriedades; vinculos e analises avancadas ficam para evolucao.
