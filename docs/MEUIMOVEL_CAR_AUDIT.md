# Auditoria MeuIMOVEL-CAR

Fase: `MODULE-HUB-MIGRATION-2`.

## O que ja existia no GeoGestao

O app principal ja possui a base GeoQuery, portanto o modulo MeuIMOVEL-CAR nao deve criar tabelas duplicadas para CAR/SIGEF/INCRA nesta fase.

Tabelas encontradas:

- `properties`;
- `property_geometries`;
- `geo_data_sources`;
- `car_properties`;
- `incra_properties`;
- `geo_alert_layers`;
- `geo_thematic_layers`;
- `property_searches`;
- `property_search_results`;
- `property_documents`.

Rotas/componentes encontrados:

- `/mapa`;
- `/api/geoquery/search`;
- `/api/geoquery/mapbiomas-alert`;
- `src/components/geoquery/geoquery-workspace.tsx`;
- `src/components/map/property-map.tsx`;
- `src/components/map/property-upload-form.tsx`.

Funcoes/RPCs encontradas:

- `find_sigef_matches_by_car`;
- `find_sigef_matches_by_car_app`;
- `find_alerts_by_car_app`;
- `refresh_geoquery_geometries`.

## App antigo

Origem auditada:

`C:\Users\srlan\Documents\Codex\2026-05-15\MeuIMOVEL-CAR`

Stack:

- Next.js 15;
- React 19;
- Supabase;
- Leaflet.

Rota antiga importante:

- `/procurar-car`.

## Implementacao desta fase

A rota `/modulos/meu-imovel-car` deixou de ser apenas placeholder e agora oferece:

- busca por CAR, nome do imovel, municipio ou UF;
- resultados de `car_properties`, respeitando `organization_id` ou bases globais;
- resultados de `properties` da organizacao atual;
- historico das ultimas consultas em `property_searches`.

## Limites atuais

- A busca por proprietario depende de esse dado existir em metadados importados; ainda nao foi feita busca profunda em JSONB.
- O mapa detalhado continua no fluxo GeoQuery existente e sera migrado de forma incremental.
- Vincular resultado a cliente/servico e salvar analise dedicada ficam preparados pela migration `045`, mas ainda nao foram expostos como acao final nesta tela.

## Plano real de migracao

1. Reaproveitar `/api/geoquery/search` para analises completas por CAR.
2. Adicionar acao de salvar resultado em `module_meuimovel_saved_results`.
3. Adicionar vinculo com cliente e servico.
4. Reaproveitar o mapa Leaflet existente com dados de `geom_geojson`.
5. Manter bases oficiais globais separadas de dados operacionais por empresa.
