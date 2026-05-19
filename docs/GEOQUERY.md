# GeoQuery - Busca de imovel por CAR Federal

Data do checkpoint: 2026-05-11

## Objetivo

A Fase GEOQUERY-1 evolui a rota `/mapa` para a ferramenta "Fazer busca de imovel". A busca parte do numero do CAR Federal e consulta bases ja importadas no Supabase/Postgres para retornar dados do CAR, possiveis correspondencias INCRA/SIGEF, documentos, camadas futuras de alertas e um mapa Leaflet/OpenStreetMap.

O Google Drive e tratado somente como repositorio bruto dos arquivos. O app nao consulta `.dbf`, shapefile ou ZIP grande no Drive a cada busca.

## Decisoes de seguranca

- Nao automatizar login gov.br.
- Nao armazenar usuario, senha, cookies ou sessao gov.br.
- Nao burlar captcha nem fazer scraping agressivo de `car.gov.br`.
- Quando o documento exigir login pessoal, o sistema mostra link oficial e orienta o usuario a baixar manualmente.
- `service_role` nao deve ser usado no frontend.
- Bases consultadas pelo app devem estar previamente importadas no banco.

## Migration

As migrations GeoQuery sao:

```text
supabase/migrations/009_geoquery_car_incra_alerts.sql
supabase/migrations/010_geoquery_spatial_matching_mapbiomas.sql
supabase/migrations/011_geoquery_sigef_rpc_app_wrapper.sql
supabase/migrations/012_geoquery_geometry_refresh_corrections.sql
supabase/migrations/013_geoquery_alerts_by_car_rpc.sql
supabase/migrations/014_geoquery_alert_attributes_and_nearby_split.sql
```

Antes de rodar a GEOQUERY-1 em Supabase remoto, aplique primeiro a migration da fase multiempresa, se ela ainda nao estiver aplicada:

```text
supabase/migrations/008_account1_organizations_profiles_ai.sql
supabase/migrations/009_geoquery_car_incra_alerts.sql
supabase/migrations/010_geoquery_spatial_matching_mapbiomas.sql
supabase/migrations/011_geoquery_sigef_rpc_app_wrapper.sql
supabase/migrations/012_geoquery_geometry_refresh_corrections.sql
supabase/migrations/013_geoquery_alerts_by_car_rpc.sql
supabase/migrations/014_geoquery_alert_attributes_and_nearby_split.sql
```

Rode primeiro no Supabase de teste. So depois de validar busca, RLS, historico e mapa, avalie aplicar no Supabase oficial.

## Estrutura de banco

A migration cria:

- `geo_data_sources`: catalogo das fontes importadas.
- `car_properties`: registros CAR e geometria/GeoJSON do imovel.
- `incra_properties`: registros INCRA/SIGEF e geometria/GeoJSON.
- `geo_alert_layers`: alertas e restricoes ambientais.
- `geo_thematic_layers`: estados, municipios, biomas, UCs, TIs e demais camadas.
- `property_searches`: historico das buscas por usuario/organizacao.
- `property_search_results`: resultados persistidos da busca.
- `property_documents`: demonstrativo CAR, CAR atualizado, shapefiles e relatorios anexados.

PostGIS e habilitado quando disponivel. Se a extensao nao puder ser habilitada no ambiente, as tabelas continuam funcionando com `geom_geojson` como fallback, e a parte espacial pesada fica pendente ate ativar PostGIS.

Na GEOQUERY-3, a migration `010_geoquery_spatial_matching_mapbiomas.sql` cria:

- `public.geojson_to_geom(jsonb)`;
- `public.refresh_geoquery_geometries(p_force boolean default false)`;
- `public.find_sigef_matches_by_car(p_cod_car, p_min_car_overlap, p_limit, p_buffer_meters)`;
- indices GiST para `geom`;
- campos normalizados em `geo_alert_layers`: `cod_car`, `cod_imovel`, `alert_code`, `codigo_alerta`, `area_intersecao_ha` e `area_alerta_ha`.

Depois de aplicar a migration no Supabase de teste, rode:

```sql
select * from public.refresh_geoquery_geometries(true);
```

A migration corretiva `012_geoquery_geometry_refresh_corrections.sql` registra os ajustes feitos manualmente no Supabase para bases grandes:

- atualiza `public.geojson_to_geom(jsonb)` para aceitar GeoJSON salvo como `Feature` ou `Geometry`, usar `ST_GeomFromGeoJSON`, `ST_Force2D`, `ST_MakeValid`, SRID 4674 e retorno `MultiPolygon`;
- cria `public.refresh_car_geom_batch(p_limit integer default 1000)`;
- cria `public.refresh_incra_geom_batch(p_limit integer default 1000)`;
- cria `public.find_sigef_matches_by_car_simple(p_cod_car, p_min_car_overlap, p_limit)` como wrapper sem buffer.

A migration `013_geoquery_alerts_by_car_rpc.sql` adiciona:

- `public.refresh_alert_geom_batch(p_limit integer default 1000)`;
- `public.find_alerts_by_car_app(p_cod_car, p_buffer_meters, p_limit)`;
- busca de alertas por `cod_car`/`cod_imovel`, por `attributes` contendo o CAR, por intersecao espacial e por buffer.

A migration `014_geoquery_alert_attributes_and_nearby_split.sql` corrige a busca de alertas:

- preenche `alert_code`, `cod_car`, `cod_imovel`, `area_alerta_ha` e `area_intersecao_ha` a partir de aliases em `attributes`, sem sobrescrever valores existentes;
- substitui `find_alerts_by_car_app` pela assinatura `p_cod_car`, `p_include_nearby`, `p_buffer_meters`, `p_limit`;
- separa alertas do imovel de alertas apenas proximos por buffer;
- retorna `match_type`, `distance_m`, `is_spatially_confirmed` e `is_nearby_only`.

## Importacao das bases

Variaveis opcionais:

```env
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_APPLICATION_CREDENTIALS=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` e somente para scripts locais/admin de importacao. Nunca use essa chave no frontend, nunca use `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` e nunca commite `.env.local`.

Variaveis server-side opcionais para MapBiomas Alerta:

```env
MAPBIOMAS_ALERT_API_URL=https://plataforma.alerta.mapbiomas.org/api/v2/graphql
MAPBIOMAS_ALERT_EMAIL=
MAPBIOMAS_ALERT_PASSWORD=
MAPBIOMAS_ALERT_TOKEN=
```

Use email/senha de uma conta MapBiomas Alerta confirmada ou forneca token direto. Essas credenciais ficam apenas no servidor ou ambiente de producao como secrets. Nao use prefixo `NEXT_PUBLIC_`.

Fluxo recomendado nesta fase:

1. Baixe os ZIPs/GeoJSON da pasta bruta do Drive.
2. Para shapefile, confirme que o ZIP contem `.shp`, `.shx`, `.dbf` e `.prj`.
3. Converta shapefile para GeoJSON com uma ferramenta GIS/ogr2ogr.
4. Para arquivo pequeno, rode a previa de importacao:

```bash
npx tsx scripts/geo/import-geojson.ts --file base.geojson --classification CAR_COMPLETA --output preview.json
```

5. Para arquivo grande, nunca carregue o GeoJSON inteiro em memoria. Use preview limitado:

```bash
npx tsx scripts/geo/import-geojson.ts --file data/geo/geojson/area_imovel_1.geojson --classification CAR_COMPLETA --limit 100 --output data/geo/previews/preview_car.json
```

6. Se quiser apenas uma amostra rapida e nao precisar contar o arquivo inteiro, use `--sample`:

```bash
npx tsx scripts/geo/import-geojson.ts --file data/geo/geojson/area_imovel_1.geojson --classification CAR_COMPLETA --sample 100 --output data/geo/previews/sample_car.json
```

7. Confira `targetTable`, `recordCount`, `sampleCount` e atributos mapeados.
8. Importe os registros no Supabase de teste para a tabela indicada usando o importador por lote.

Classificacoes aceitas incluem `CAR_COMPLETA`, `INCRA_PERIMETROS`, `ALERTA_DESMATAMENTO`, `CAR_ALERT_INTERSECTION`, `ESTADOS`, `MUNICIPIOS`, `BIOMAS`, `UNIDADES_CONSERVACAO`, `TERRAS_INDIGENAS`, `AREAS_EMBARGADAS`, `MATOPIBA`, `SEMIARIDO` e `OUTROS`.

Use `CAR_ALERT_INTERSECTION` para a base `car_with_alerts_and_intersections`. Ela grava em `geo_alert_layers` e preserva atributos originais, alem de normalizar `cod_car`, `cod_imovel`, `alert_code`, `codigo_alerta`, `area_intersecao_ha` e `area_alerta_ha`.

DBF isolado pode ser usado apenas para atributos. Sem `.shp/.shx/.prj`, nao ha perimetro para renderizar no mapa.

### Importacao real por lote

Antes de rodar a importacao real, aplique as migrations 008 e 009 no Supabase de teste e configure no terminal:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto-de-teste.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key-do-projeto-de-teste"
```

Depois rode:

```bash
npx tsx scripts/geo/import-geojson-to-supabase.ts --file data/geo/geojson/area_imovel_1.geojson --classification CAR_COMPLETA --batch-size 100 --source-name "CAR area_imovel_1" --provider SICAR
```

Exemplo para a base de alertas cruzados com CAR:

```bash
npx tsx scripts/geo/import-geojson-to-supabase.ts --file data/geo/geojson/car_with_alerts_and_intersections.geojson --classification CAR_ALERT_INTERSECTION --batch-size 100 --source-name "MapBiomas CAR x alertas" --provider MapBiomas
```

Opcoes uteis:

- `--batch-size 100` ou `--batch-size 500`: tamanho dos lotes.
- `--organization-id <uuid>`: grava a base para uma organizacao especifica. Sem isso, a base fica global (`organization_id = null`).
- `--reference-year 2026`: registra ano de referencia em `geo_data_sources`.
- `--dry-run`: le e mapeia os registros sem gravar no Supabase.

O script registra uma linha em `geo_data_sources`, grava `source_id` nos registros importados, preserva `attributes` em JSONB, salva `geom_geojson`, evita duplicidade de `cod_car` dentro do possivel e mostra progresso no terminal.

As colunas PostGIS `geom`, quando existirem, podem ser preenchidas depois por SQL administrativo a partir de `geom_geojson`. A importacao inicial grava o GeoJSON com seguranca para nao depender de funcao RPC extra.

### Refresh de geometria apos importar CAR/INCRA

Depois de importar bases CAR ou INCRA/SIGEF, preencha `geom` a partir de `geom_geojson` em lotes. Rode primeiro no Supabase de teste:

```sql
select * from public.refresh_car_geom_batch(1000);
```

Repita ate `processed_count = 0`. Depois rode:

```sql
select * from public.refresh_incra_geom_batch(1000);
```

Repita ate `processed_count = 0`. Se o SQL Editor der timeout ou `Failed to fetch`, reduza o lote:

```sql
select * from public.refresh_car_geom_batch(100);
select * from public.refresh_incra_geom_batch(100);
```

Confira quantos registros possuem geometria PostGIS:

```sql
select
  'car_properties' as table_name,
  count(*) as total,
  count(geom) as with_geom,
  count(*) filter (where geom_geojson is not null and geom is null) as pending_geom
from public.car_properties
union all
select
  'incra_properties' as table_name,
  count(*) as total,
  count(geom) as with_geom,
  count(*) filter (where geom_geojson is not null and geom is null) as pending_geom
from public.incra_properties;
```

Depois de criar ou substituir funcoes RPC, recarregue o schema do PostgREST:

```sql
notify pgrst, 'reload schema';
```

Para validar o cruzamento espacial no Supabase:

```sql
select *
from public.find_sigef_matches_by_car(
  'GO-5206404-4BEFC4B149154D00A124C29582FF62B5',
  0.60,
  10,
  0
);
```

Ou use o wrapper simples, sem parametro de buffer:

```sql
select *
from public.find_sigef_matches_by_car_simple(
  'GO-5206404-4BEFC4B149154D00A124C29582FF62B5',
  0.60,
  10
);
```

### Refresh e teste de alertas importados

Depois de importar `CAR_ALERT_INTERSECTION` ou `ALERTA_DESMATAMENTO`, preencha `geom` dos alertas em lotes:

```sql
select * from public.refresh_alert_geom_batch(1000);
```

Repita ate `processed_count = 0`. Se o SQL Editor falhar por timeout, reduza:

```sql
select * from public.refresh_alert_geom_batch(100);
```

Confira se ha alertas com geometria:

```sql
select
  count(*) as total,
  count(geom_geojson) as with_geojson,
  count(geom) as with_geom,
  count(*) filter (where geom_geojson is not null and geom is null) as pending_geom
from public.geo_alert_layers;
```

Teste a busca de alertas importados por CAR:

```sql
select *
from public.find_alerts_by_car_app(
  'GO-5204508-05BCE2EEAB2F4ED0B8593CDC763047F6',
  false,
  500,
  50
);
```

O campo `match_type` indica como o alerta foi encontrado:

- `direct_code`: `cod_car` ou `cod_imovel`;
- `attributes_code`: CAR encontrado dentro de `attributes`;
- `spatial_intersection`: geometria do alerta intersecta o CAR;
- `spatial_buffer`: alerta encontrado no buffer configurado, retornado somente quando `p_include_nearby = true`.

Para verificar alertas proximos separadamente:

```sql
select *
from public.find_alerts_by_car_app(
  'GO-5204508-05BCE2EEAB2F4ED0B8593CDC763047F6',
  true,
  500,
  50
)
where is_nearby_only is true;
```

### Criando amostras no QGIS

Para validar uma base grande antes da carga completa:

1. Abra o shapefile/GeoJSON no QGIS.
2. Use "Exportar" / "Salvar feicoes como".
3. Escolha GeoJSON.
4. Use filtro ou selecao para salvar 50 a 500 feicoes.
5. Rode o preview/importacao contra essa amostra no Supabase de teste.

### Arquivos grandes e Git

Arquivos brutos ficam fora do Git. O `.gitignore` bloqueia `data/geo/`, shapefiles, DBF, PRJ, GeoJSON e ZIPs. Use essa pasta para bases locais e previews temporarios.

## API interna

Endpoint criado:

```text
POST /api/geoquery/search
```

Payload:

```json
{
  "codCar": "PR-1234567-ABCDEF0000",
  "clientId": null,
  "serviceCardId": null,
  "propertyId": null,
  "bufferMeters": 500
}
```

Retorno:

- `status`: `found`, `partial` ou `not_found`.
- `summary.message`: mensagem de resultado.
- `car`: dados CAR quando encontrados.
- `incra`: correspondencias INCRA/SIGEF iniciais.
- `geojson`: camadas para renderizacao.
- `officialLinks`: links oficiais CAR/gov.br.
- `searchId`: historico salvo.
- `incra`: correspondencias SIGEF por sobreposicao espacial;
- `alerts`: alertas importados e, quando configurado, alertas vindos da API MapBiomas.

Se nao houver base importada, a resposta mostra:

```text
Base CAR ainda nao importada.
```

## Interface

A rota `/mapa` continua existindo, mas o menu passa a exibir "Fazer busca de imovel".

A tela contem:

- campo "Numero do CAR Federal";
- vinculo opcional a cliente, servico/card tecnico e imovel cadastrado;
- checkbox "Incluir alertas proximos";
- links oficiais para consulta publica CAR e Central CAR/gov.br;
- historico das buscas;
- abas de resultado: Resumo, CAR, INCRA/SIGEF, Alertas, Tematicas, Documentos e Arquivos vetoriais;
- mapa Leaflet/OpenStreetMap;
- cadastro manual KML/KMZ mantido para compatibilidade.

Os controles tecnicos ficam ocultos da tela operacional. O app usa internamente:

- buffer de alertas proximos: 500 m;
- sobreposicao minima SIGEF/CAR: 60%;
- buffer SIGEF: 0 m.

Alertas proximos so aparecem quando o usuario marca "Incluir alertas proximos" e ficam separados de "Alertas do imovel".

### Cruzamento CAR x SIGEF

SIGEF/INCRA nao possui o CAR Federal como chave confiavel. Por isso, o GeoGestao cruza geometrias:

1. busca o poligono CAR por `cod_car`;
2. usa `car_properties.geom`;
3. procura `incra_properties.geom` com `ST_Intersects`;
4. calcula area de intersecao com `ST_Area(geom::geography) / 10000`;
5. considera correspondencia provavel quando `intersection_area / car_area >= 0.60`.

A UI usa a sobreposicao minima interna de 60%. Se a RPC PostGIS falhar, a API usa fallback simples por `bbox`/GeoJSON e mostra aviso no resumo.

### MapBiomas Alerta

O GeoGestao usa a API oficial GraphQL:

```text
https://plataforma.alerta.mapbiomas.org/api/v2/graphql
```

Fluxo:

1. se `MAPBIOMAS_ALERT_TOKEN` existir, usa o Bearer token direto;
2. senao, se `MAPBIOMAS_ALERT_EMAIL` e `MAPBIOMAS_ALERT_PASSWORD` existirem, executa `signIn`;
3. cacheia o token em memoria no servidor;
4. consulta `ruralProperty(carCode)` como fonte principal para descobrir alertas validos da API para o CAR;
5. consulta `alert(alertCode, carCode)` para detalhes do alerta/laudo;
6. quando `alert(alertCode, carCode)` retorna `null`, a UI mostra mensagem clara de que a API nao encontrou esse alerta para o CAR pesquisado.

O sistema nao faz scraping no site do MapBiomas. Se a API nao retornar link direto de PDF/laudo, o GeoGestao gera um PDF interno com os dados oficiais retornados pela API, identificado como "Laudo GeoGestao - Dados MapBiomas Alerta". Esse PDF nao e prometido como PDF oficial do MapBiomas.

Endpoint interno para PDF do alerta:

```text
POST /api/geoquery/mapbiomas-alert/report
```

Payload:

```json
{
  "carCode": "GO-5219753-80EEBF1E6C744118A4C94B2EB35DAE83",
  "alertCode": 1174369
}
```

O endpoint valida o usuario autenticado, consulta a API MapBiomas no servidor, nunca retorna token ao frontend e responde com `application/pdf` quando os dados do alerta existem.

## Documentos oficiais

O GeoGestao nao baixa documentos que exigem login pessoal. A UI orienta o usuario a abrir a Central do CAR/gov.br, baixar o demonstrativo ou CAR atualizado manualmente e anexar pelo fluxo de documentos/anexos. A tabela `property_documents` fica preparada para vincular esses arquivos ao CAR, cliente e servico.

## Relatorio

A tela tem acao "Gerar relatorio da busca" usando impressao do navegador. PDF automatico e exportacao shapefile ZIP ficam como evolucao futura.

## Testes

Cobertura adicionada:

- normalizacao e validacao de numero CAR;
- normalizacao de campos DBF;
- mapeamento de aliases CAR/INCRA;
- classificacao de camadas para tabela de destino;
- E2E da tela `/mapa` validando o novo titulo, campo CAR e links oficiais.

Comandos:

```bash
npm run typecheck
npm run build
npm run test
```

## Limitacoes conhecidas

- A importacao direta via Google Drive API esta documentada/preparada, mas o app ainda nao lista a pasta automaticamente.
- GEOQUERY-2A adiciona preview por streaming e importador por lote para Supabase de teste.
- GEOQUERY-3 adiciona preenchimento de `geom`, RPC de cruzamento CAR x SIGEF e integracao server-side com MapBiomas Alerta.
- O importador por lote grava `geom_geojson`; depois rode `refresh_geoquery_geometries(true)` para preencher `geom`.
- Alertas locais por buffer ficam separados de alertas do imovel e nao sao desenhados como se estivessem dentro do CAR.
- O anexo dedicado de demonstrativo/CAR atualizado esta preparado por schema; a UI final dedicada de upload ainda pode ser refinada.
- PDF automatico do relatorio geral da busca e shapefile ZIP para download ficam como fase futura; PDF interno de alerta MapBiomas ja e gerado pelo endpoint do laudo.
