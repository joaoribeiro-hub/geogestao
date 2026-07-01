# Modulo MeuIMOVEL-CAR

Fase: `MODULE-HUB-REAL-PORT-1`.

## Origem Auditada

Pasta encontrada:

`C:\Users\srlan\Documents\Codex\2026-05-15\MeuIMOVEL-CAR`

Arquivos relevantes:

- `COMO_RODAR.md`
- `src/app/api/geoquery/search/route.ts`
- `src/components/map/*`
- `src/components/layout/app-shell.tsx`

## Rota

- `/modulos/meu-imovel-car`

## Status

Beta.

O modulo reaproveita tabelas GeoQuery e dados existentes do GeoGestao, sem duplicar CAR/SIGEF/INCRA.

## Funcional Agora

- Busca por CAR, municipio, UF, nome do imovel ou CAR salvo.
- Consulta `car_properties` global/organizacao e `properties` da organizacao atual.
- Historico basico em `property_searches`.
- Link para abrir a consulta GeoQuery completa em `/mapa`.

## Preparado

A migration 046 cria:

- `module_meu_imovel_queries`;
- `module_meu_imovel_alerts`.

Essas tabelas ficam prontas para salvar consultas e alertas especificos do modulo com `organization_id`.
