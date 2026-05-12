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

A migration nova e:

```text
supabase/migrations/009_geoquery_car_incra_alerts.sql
```

Antes de rodar a GEOQUERY-1 em Supabase remoto, aplique primeiro a migration da fase multiempresa, se ela ainda nao estiver aplicada:

```text
supabase/migrations/008_account1_organizations_profiles_ai.sql
supabase/migrations/009_geoquery_car_incra_alerts.sql
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

Classificacoes aceitas incluem `CAR_COMPLETA`, `INCRA_PERIMETROS`, `ALERTA_DESMATAMENTO`, `ESTADOS`, `MUNICIPIOS`, `BIOMAS`, `UNIDADES_CONSERVACAO`, `TERRAS_INDIGENAS`, `AREAS_EMBARGADAS`, `MATOPIBA`, `SEMIARIDO` e `OUTROS`.

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

Opcoes uteis:

- `--batch-size 100` ou `--batch-size 500`: tamanho dos lotes.
- `--organization-id <uuid>`: grava a base para uma organizacao especifica. Sem isso, a base fica global (`organization_id = null`).
- `--reference-year 2026`: registra ano de referencia em `geo_data_sources`.
- `--dry-run`: le e mapeia os registros sem gravar no Supabase.

O script registra uma linha em `geo_data_sources`, grava `source_id` nos registros importados, preserva `attributes` em JSONB, salva `geom_geojson`, evita duplicidade de `cod_car` dentro do possivel e mostra progresso no terminal.

As colunas PostGIS `geom`, quando existirem, podem ser preenchidas depois por SQL administrativo a partir de `geom_geojson`. A importacao inicial grava o GeoJSON com seguranca para nao depender de funcao RPC extra.

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

Se nao houver base importada, a resposta mostra:

```text
Base CAR ainda nao importada.
```

## Interface

A rota `/mapa` continua existindo, mas o menu passa a exibir "Fazer busca de imovel".

A tela contem:

- campo "Numero do CAR Federal";
- vinculo opcional a cliente, servico/card tecnico e imovel cadastrado;
- buffer de alertas proximos;
- links oficiais para consulta publica CAR e Central CAR/gov.br;
- painel de bases importadas;
- historico das buscas;
- abas de resultado: Resumo, CAR, INCRA/SIGEF, Alertas, Tematicas, Documentos e Arquivos vetoriais;
- mapa Leaflet/OpenStreetMap;
- cadastro manual KML/KMZ mantido para compatibilidade.

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
- O importador por lote grava `geom_geojson`; preenchimento automatico da coluna PostGIS `geom` ainda deve ser feito por SQL administrativo ou funcao RPC futura.
- Intersecao espacial real, buffer e calculo de area de alertas dependem de PostGIS e ainda nao estao ligados na API.
- A correspondencia INCRA inicial usa atributos como UF/municipio quando nao ha operacao espacial.
- O anexo dedicado de demonstrativo/CAR atualizado esta preparado por schema; a UI final dedicada de upload ainda pode ser refinada.
- PDF automatico do relatorio e shapefile ZIP para download ficam como fase futura.
