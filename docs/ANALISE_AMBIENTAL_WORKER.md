# Análise Ambiental Worker

Fase: `ANALISE-AMBIENTAL-WORKER-1`.
Complemento: `ANALISE-AMBIENTAL-WORKER-2-CAMADAS-E-OUTPUTS`.
Complemento: `ANALISE-AMBIENTAL-MAPBIOMAS-REAL-1`.
Complemento: `ANALISE-AMBIENTAL-GEE-AUTO-1`.
Complemento: `ANALISE-AMBIENTAL-ANA-HIDRO-1`.

## Arquitetura

A ferramenta `/ferramentas/analise-ambiental` continua no Next.js para autenticação, upload, histórico e signed URLs. O processamento geoespacial pesado roda em worker Python separado, em `workers/analise-ambiental`.

O worker não roda no frontend, não usa Edge Function e não processa raster dentro do Next/Vercel.

## Banco

Migration incremental:

```text
supabase/migrations/050_analise_ambiental_worker.sql
supabase/migrations/051_analise_ambiental_layers_outputs.sql
supabase/migrations/052_analise_ambiental_mapbiomas_real.sql
supabase/migrations/053_analise_ambiental_gee_auto.sql
```

Ela adiciona ao `module_environmental_analysis_jobs` campos de geometria, CRS, área, progresso, warnings, resumo e paths dos outputs.

A migration `051` adiciona `environmental_analysis_outputs`, com um registro por camada/formato.

A migration `052` adiciona `input_raster_storage_path` para teste com GeoTIFF MapBiomas recortado e diferencia status `simulado` de resultado real.

A migration `053` adiciona o status `export_required` para AOIs que excedam o download direto do Earth Engine.

## Storage

Bucket privado:

```text
documentos
```

Entrada:

```text
organizations/{organization_id}/modules/analise-ambiental/{job_id}/original/{arquivo}
```

Saídas por camada:

```text
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/limite/limite.kml
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/limite/limite.geojson
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/limite/limite.shp.zip
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/vegetacao_existente/vegetacao_existente.kml
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/vegetacao_existente/vegetacao_existente.geojson
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/vegetacao_existente/vegetacao_existente.shp.zip
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/agua_represa/agua_represa.kml
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/agua_represa/agua_represa.geojson
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/agua_represa/agua_represa.shp.zip
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/drenagem_corrego/drenagem_corrego.kml
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/drenagem_corrego/drenagem_corrego.geojson
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/drenagem_corrego/drenagem_corrego.shp.zip
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/relatorio_ambiental.json
organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/pacote_resultados.zip
```

Shapefile sempre é entregue como `.shp.zip` com `.shp`, `.shx`, `.dbf`, `.prj` e `.cpg` quando aplicável.

## Variáveis no Next

```env
ANALISE_AMBIENTAL_WORKER_URL=http://127.0.0.1:8020
ANALISE_AMBIENTAL_WORKER_SECRET=
ANALISE_AMBIENTAL_STORAGE_BUCKET=documentos
```

Se `ANALISE_AMBIENTAL_WORKER_URL` ou `ANALISE_AMBIENTAL_WORKER_SECRET` não existirem, o upload ainda cria o job e a interface avisa que o worker precisa ser configurado.

## Variáveis no worker

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANALISE_AMBIENTAL_WORKER_SECRET=
ANALISE_AMBIENTAL_STORAGE_BUCKET=documentos
ANALISE_AMBIENTAL_PROVIDER=mapbiomas_gee
ANALISE_AMBIENTAL_LOCAL_FIXTURE_ENABLED=true
ANALISE_AMBIENTAL_GEE_ENABLED=false
ANALISE_AMBIENTAL_POLL_ENABLED=false
GEE_PROJECT_ID=
GEE_SERVICE_ACCOUNT_EMAIL=
GEE_PRIVATE_KEY=
GEE_SERVICE_ACCOUNT_JSON_BASE64=
MAPBIOMAS_10M_ASSET_ID=
MAPBIOMAS_RASTER_LOCAL_PATH=
MAPBIOMAS_RASTER_URL=
MAPBIOMAS_YEAR=2025
MAPBIOMAS_COLLECTION=coverage_10m
ANALISE_AMBIENTAL_HIDRO_PROVIDER=ana_bho6_gpkg
ANA_BHO6_TRECHO_DRENAGEM_URL=
ANA_BHO6_TRECHO_DRENAGEM_PATH=
ANA_BHO6_CURSO_DAGUA_URL=
ANA_BHO6_AREA_DRENAGEM_URL=
ANA_MASSAS_DAGUA_URL=
ANA_HIDRO_CACHE_DIR=./data/ana
ANA_HIDRO_ENABLE_ARCGIS_FALLBACK=false
```

`SUPABASE_SERVICE_ROLE_KEY` é permitida apenas no worker/backend. Nunca usar no frontend.

## Provider MapBiomas real

O provider principal é `mapbiomas_gee`. Ele usa Google Earth Engine server-side para baixar automaticamente a classificação MapBiomas recortada pela AOI e processa o GeoTIFF localmente com Rasterio.

Prioridade de providers:

1. `ANALISE_AMBIENTAL_PROVIDER=mapbiomas_gee`: usa Earth Engine.
2. `input_raster_storage_path`: usa GeoTIFF manual avançado.
3. `MAPBIOMAS_RASTER_URL` ou `MAPBIOMAS_RASTER_LOCAL_PATH`: usa raster público/configurado.
4. `dev_fixture`: apenas se explicitamente habilitado, sempre simulado.

Variáveis principais:

```env
ANALISE_AMBIENTAL_PROVIDER=mapbiomas_gee
GEE_PROJECT_ID=
GEE_SERVICE_ACCOUNT_EMAIL=
GEE_PRIVATE_KEY=
GEE_SERVICE_ACCOUNT_JSON_BASE64=
MAPBIOMAS_10M_ASSET_ID=
MAPBIOMAS_YEAR=2025
MAPBIOMAS_COLLECTION=coverage_10m
```

`MAPBIOMAS_10M_ASSET_ID` não fica hardcoded porque asset, coleção e ano podem mudar.

Camadas mínimas geradas quando houver pixels correspondentes:

- `limite`;
- `vegetacao_nativa`;
- `floresta`;
- `agropecuaria`;
- `agua`;
- `area_nao_vegetada`.

Os códigos ficam centralizados em `workers/analise-ambiental/app/mapbiomas_classes.py`.

## Provider Hidrografia oficial ANA/BHO6

O provider `ana_hidrografia_oficial` usa a Base Hidrográfica Ottocodificada Multiescalas 6 — BHO 6, versão 6.2.4, da ANA/SNIRH.

Produto principal:

```text
GEOFT_BHO_TRECHO_DRENAGEM.gpkg
```

Configuração:

```env
ANALISE_AMBIENTAL_HIDRO_PROVIDER=ana_bho6_gpkg
ANA_BHO6_TRECHO_DRENAGEM_URL=
ANA_BHO6_TRECHO_DRENAGEM_PATH=
ANA_HIDRO_CACHE_DIR=./data/ana
ANA_HIDRO_ENABLE_ARCGIS_FALLBACK=false
```

Regras:

- `ANA_BHO6_TRECHO_DRENAGEM_PATH` pode apontar para um GPKG local já baixado.
- `ANA_BHO6_TRECHO_DRENAGEM_URL` pode apontar para `.gpkg` ou `.zip` contendo o GPKG. O worker baixa uma vez para `ANA_HIDRO_CACHE_DIR` e reutiliza nos próximos jobs.
- A AOI é reprojetada para `EPSG:4674`, a leitura usa filtro por `bbox`, e o resultado é recortado/intersectado pela propriedade.
- A camada gerada é `hidrografia_oficial`, com KML, GeoJSON e SHP.zip.
- O relatório registra `provider=ana_hidrografia_oficial`, fonte `ANA/SNIRH BHO 6`, versão `6.2.4`, CRS `EPSG:4674`, quantidade de trechos e nomes encontrados quando houver atributo de nome.
- Não confundir com `agua`: `agua` vem do raster MapBiomas; `hidrografia_oficial` vem da base vetorial oficial da ANA.
- O fallback ArcGIS fica preparado por variável, mas não é a fonte principal nesta fase.

## Service account Google/Earth Engine

Passos resumidos:

1. Criar ou escolher um projeto no Google Cloud.
2. Habilitar as APIs necessárias para Earth Engine.
3. Criar uma service account.
4. Gerar uma chave JSON da service account.
5. Garantir que a service account tenha acesso ao Earth Engine e ao asset configurado em `MAPBIOMAS_10M_ASSET_ID`.
6. Configurar no worker, nunca no frontend:
   - `GEE_PROJECT_ID`;
   - `GEE_SERVICE_ACCOUNT_JSON_BASE64`; ou
   - `GEE_SERVICE_ACCOUNT_EMAIL` e `GEE_PRIVATE_KEY`.

Se o provider GEE não estiver configurado, o job fica `provider_pendente` e a UI mostra:

```text
Provider MapBiomas/GEE não configurado no worker. Configure GEE_PROJECT_ID, credenciais da service account e MAPBIOMAS_10M_ASSET_ID.
```

Se o recorte exceder o download direto de `ee.Image.getDownloadURL`, o job fica `export_required`; exportação assíncrona fica preparada para próxima fase.

## Endpoints

Worker:

- `GET /health`
- `POST /jobs/{job_id}/process`
- `POST /jobs/poll`

Next:

- `GET /api/tools/analise-ambiental/jobs`
- `POST /api/tools/analise-ambiental/jobs`
- `GET /api/tools/analise-ambiental/jobs/[id]`
- `POST /api/tools/analise-ambiental/jobs/[id]/process`
- `GET /api/tools/analise-ambiental/jobs/[id]/outputs`

Rotas de processamento exigem `Authorization: Bearer <ANALISE_AMBIENTAL_WORKER_SECRET>`.

## Fixture local

Para validar sem consultar dados externos:

```bash
cd workers/analise-ambiental
python -m app.tools.create_dev_fixture
uvicorn main:app --host 127.0.0.1 --port 8020
```

O provider local registra `provider = dev_fixture`, `official_data = false`, status `simulado` e aviso explícito:

```text
Resultado simulado para teste. Não usar como análise ambiental real.
```

Resultados `dev_fixture` não devem ser apresentados como análise ambiental real.

## Limitações

- OCR, hidrologia real por DEM e exportação assíncrona GEE ficam para fase futura.
- `mapbiomas_gee` depende de credenciais GEE e asset configurado; sem isso, o job fica com provider pendente e não inventa camada ambiental.
- O worker precisa ficar online para processar jobs; sem worker, o job permanece `worker_pendente`.

## Render Free

O container usa `PORT` fornecida pelo Render, com fallback local `8020`, instala GDAL/GEOS/PROJ e expõe `GET /health` com `service: analise-ambiental`. O filesystem do plano Free é efêmero; entradas, resultados e metadados continuam no Supabase Storage. O cache ANA em `/tmp/ana` pode ser recriado depois de um restart. O app Next aciona o worker somente por API server-side com `ANALISE_AMBIENTAL_WORKER_URL` e `ANALISE_AMBIENTAL_WORKER_SECRET`.
