# Worker Análise Ambiental

Worker FastAPI separado do Next.js para processar jobs da ferramenta `/ferramentas/analise-ambiental`.

## Rotas

- `GET /health`
- `POST /jobs/{job_id}/process`
- `POST /jobs/poll`

As rotas de processamento exigem:

```text
Authorization: Bearer <ANALISE_AMBIENTAL_WORKER_SECRET>
```

## Variáveis

Copie `.env.example` para `.env.local` e configure:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANALISE_AMBIENTAL_WORKER_SECRET=
ANALISE_AMBIENTAL_STORAGE_BUCKET=documentos
ANALISE_AMBIENTAL_PROVIDER=mapbiomas_gee
ANALISE_AMBIENTAL_LOCAL_FIXTURE_ENABLED=true
GEE_PROJECT_ID=
GEE_SERVICE_ACCOUNT_EMAIL=
GEE_PRIVATE_KEY=
GEE_SERVICE_ACCOUNT_JSON_BASE64=
MAPBIOMAS_10M_ASSET_ID=
MAPBIOMAS_RASTER_LOCAL_PATH=
MAPBIOMAS_RASTER_URL=
MAPBIOMAS_YEAR=2025
MAPBIOMAS_COLLECTION=coverage_10m
ANALISE_AMBIENTAL_GEE_ENABLED=false
ANALISE_AMBIENTAL_HIDRO_PROVIDER=ana_bho6_gpkg
ANA_BHO6_TRECHO_DRENAGEM_URL=
ANA_BHO6_TRECHO_DRENAGEM_PATH=
ANA_HIDRO_CACHE_DIR=./data/ana
ANA_HIDRO_ENABLE_ARCGIS_FALLBACK=false
```

`SUPABASE_SERVICE_ROLE_KEY` fica somente no worker/backend. Nunca use no frontend.

## Desenvolvimento local

Na raiz do projeto:

```bat
setup-analise-ambiental-worker.bat
iniciar-analise-ambiental-worker.bat
```

Ou manualmente:

```bash
cd workers/analise-ambiental
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements-base.txt
python -m app.tools.create_dev_fixture
uvicorn main:app --host 127.0.0.1 --port 8020
```

No Next.js:

```env
ANALISE_AMBIENTAL_WORKER_URL=http://127.0.0.1:8020
ANALISE_AMBIENTAL_WORKER_SECRET=
ANALISE_AMBIENTAL_STORAGE_BUCKET=documentos
```

## Fixture local

`python -m app.tools.create_dev_fixture` cria um GeoTIFF pequeno e um KML de teste em `data/dev`.

Resultados baseados nesse raster são marcados com `provider = dev_fixture`, `official_data = false` e status `simulado`. Eles servem para validar o pipeline; não são dados oficiais de produção.

## MapBiomas/GEE automático

Para processar classes reais por pixel usando apenas KML/KMZ/ZIP:

```env
ANALISE_AMBIENTAL_PROVIDER=mapbiomas_gee
GEE_PROJECT_ID=
GEE_SERVICE_ACCOUNT_JSON_BASE64=
MAPBIOMAS_10M_ASSET_ID=
MAPBIOMAS_YEAR=2025
MAPBIOMAS_COLLECTION=coverage_10m
```

Também é possível usar `GEE_SERVICE_ACCOUNT_EMAIL` + `GEE_PRIVATE_KEY` no lugar de `GEE_SERVICE_ACCOUNT_JSON_BASE64`.

O asset MapBiomas não fica hardcoded. Configure `MAPBIOMAS_10M_ASSET_ID` conforme coleção/ano/asset que a service account pode acessar.

## MapBiomas por GeoTIFF avançado

Também é possível anexar um GeoTIFF no campo avançado da tela `/ferramentas/analise-ambiental` ou configurar:

```env
MAPBIOMAS_RASTER_LOCAL_PATH=C:\bases\mapbiomas\recorte.tif
MAPBIOMAS_RASTER_URL=
```

O worker recorta o raster pela AOI, polygoniza as classes e gera KML, GeoJSON e SHP.zip para `vegetacao_nativa`, `floresta`, `agropecuaria`, `agua` e `area_nao_vegetada`, quando houver pixels correspondentes.

## Hidrografia oficial ANA/BHO6

Para habilitar a camada vetorial oficial:

```env
ANALISE_AMBIENTAL_HIDRO_PROVIDER=ana_bho6_gpkg
ANA_BHO6_TRECHO_DRENAGEM_PATH=C:\bases\ana\GEOFT_BHO_TRECHO_DRENAGEM.gpkg
```

Também é possível configurar `ANA_BHO6_TRECHO_DRENAGEM_URL` para `.gpkg` ou `.zip`; o worker baixa uma vez para `ANA_HIDRO_CACHE_DIR`.

A saída é `hidrografia_oficial` com KML, GeoJSON e SHP.zip, fonte `ANA/SNIRH BHO 6`, versão `6.2.4` e CRS de processamento `EPSG:4674`.

## Saídas

O worker grava no bucket privado `documentos`:

```text
organizations/{organization_id}/modules/analise-ambiental/{job_id}/outputs/limite.geojson
organizations/{organization_id}/modules/analise-ambiental/{job_id}/outputs/limite.kml
organizations/{organization_id}/modules/analise-ambiental/{job_id}/outputs/relatorio.json
```

Quando a fixture local está disponível, também pode gravar:

```text
vegetacao.geojson
agua.geojson
```

## GEE

`mapbiomas_gee` baixa o recorte por `ee.Image.getDownloadURL`. Se a AOI exceder o limite de download direto, o job fica `export_required`; exportação assíncrona fica para próxima fase.
