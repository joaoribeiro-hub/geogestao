# Modulo BuscaGEO

Fase atual: `BUSCAGEO-REAL-INTEGRATION-1`.

## Origem auditada

Pasta original:

`C:\Users\srlan\Documents\Codex\2026-05-14\files-mentioned-by-the-user-buscar\BuscaGEO`

Arquivos reaproveitados:

- `backend/app/geo.py`: leitura KML/KMZ/Shapefile ZIP com GDAL/OGR.
- `backend/app/cbers.py`: busca STAC CBERS/INPE, recorte remoto e preview PNG.
- `backend/app/mosaic.py`: mosaico, normalizacao e reprojecao cubic.
- `src/components/buscageo/buscageo-workspace.tsx`: fluxo visual usado como referencia.

O app local antigo e os arquivos `.bat` nao sao executados dentro do GeoGestao.

## Rota

- `/modulos/buscageo`

## Fluxo atual

1. Usuario envia KML, KMZ ou Shapefile ZIP.
2. O Next cria um registro em `module_buscageo_jobs`.
3. O arquivo vai para o bucket privado `documentos`.
4. O worker FastAPI le a geometria com GDAL/OGR.
5. O worker busca cenas CBERS no STAC do INPE.
6. O worker recorta ate 5 cenas validas e cria previews PNG.
7. O usuario seleciona 1 ou 2 cenas.
8. O worker gera o mosaico e o GeoTIFF final.
9. O app entrega download por signed URL.

## Storage

Bucket:

`documentos`

Paths:

```text
organizations/{organization_id}/modules/buscageo/{job_id}/input/{filename}
organizations/{organization_id}/modules/buscageo/{job_id}/preview/{image_id}.png
organizations/{organization_id}/modules/buscageo/{job_id}/output/originals/{scene}.tif
organizations/{organization_id}/modules/buscageo/{job_id}/output/{filename}.tif
```

## Banco

Tabela principal:

`module_buscageo_jobs`

Campos relevantes:

- `organization_id`;
- `user_id`;
- `status`;
- `input_filename`;
- `input_storage_path`;
- `input_mime_type`;
- `input_size_bytes`;
- `geometry`;
- `bbox`;
- `area_ha`;
- `parameters`;
- `scenes`;
- `selected_scenes`;
- `preview_storage_path`;
- `output_storage_path`;
- `output_filename`;
- `logs`;
- `error_message`.

Statuses:

- `draft`;
- `uploaded`;
- `geometry_ready`;
- `searching_scenes`;
- `scenes_ready`;
- `processing`;
- `done`;
- `failed`;
- `canceled`;
- `worker_pending`.

## APIs internas

- `GET /api/modules/buscageo/jobs`
- `POST /api/modules/buscageo/jobs`
- `GET /api/modules/buscageo/jobs/[id]`
- `POST /api/modules/buscageo/jobs/[id]/read-geometry`
- `POST /api/modules/buscageo/jobs/[id]/search-scenes`
- `POST /api/modules/buscageo/jobs/[id]/process`
- `POST /api/modules/buscageo/jobs/[id]/cancel`
- `GET /api/modules/buscageo/jobs/[id]/download`
- `POST /api/modules/buscageo/worker/callback`

O callback exige `BUSCAGEO_WORKER_SECRET`.

## Variaveis

No Next.js:

```env
BUSCAGEO_WORKER_URL=
BUSCAGEO_WORKER_SECRET=
BUSCAGEO_STORAGE_BUCKET=documentos
```

No worker:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
BUSCAGEO_WORKER_SECRET=
BUSCAGEO_STORAGE_BUCKET=documentos
```

`SUPABASE_SERVICE_ROLE_KEY` fica apenas no worker/server. Nunca usar no frontend.

## Migration

Aplicar:

`supabase/migrations/047_buscageo_real_integration.sql`

Ela:

- ajusta `app_modules_status_check`;
- registra BuscaGEO como `beta`;
- garante o bucket privado `documentos` com MIME types KML/KMZ/ZIP/TIFF;
- completa `module_buscageo_jobs`;
- adiciona RLS de leitura, insert, update e delete por organizacao.

## Limites

- O processamento real depende de ambiente Python com GDAL.
- OCR, vetorizacao avancada e selecao automatica inteligente de melhores cenas ficam fora desta fase.
- O worker roda separado do Next para evitar processamento pesado em server action/Vercel.
