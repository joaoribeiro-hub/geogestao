# BuscaGEO Worker

O BuscaGEO usa um worker FastAPI separado para as rotinas pesadas de GDAL/OGR, STAC CBERS, previews e mosaico.

## Pasta

`workers/buscageo`

## Rodar localmente

```bash
cd workers/buscageo
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8010
```

No app Next:

```env
BUSCAGEO_WORKER_URL=http://127.0.0.1:8010
BUSCAGEO_WORKER_SECRET=uma-string-forte
BUSCAGEO_STORAGE_BUCKET=documentos
```

No worker:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
BUSCAGEO_WORKER_SECRET=mesma-string-forte
BUSCAGEO_STORAGE_BUCKET=documentos
```

## Endpoints do worker

- `GET /health`
- `POST /jobs/{job_id}/read-geometry`
- `POST /jobs/{job_id}/search-scenes`
- `POST /jobs/{job_id}/process`

Todos os endpoints de escrita exigem:

```http
Authorization: Bearer BUSCAGEO_WORKER_SECRET
```

## Callback

O worker recebe `callback_url` do Next e devolve atualizacoes para:

`POST /api/modules/buscageo/worker/callback`

O callback atualiza `module_buscageo_jobs` server-side com:

- `geometry`;
- `bbox`;
- `area_ha`;
- `scenes`;
- `selected_scenes`;
- `output_storage_path`;
- `output_filename`;
- `logs`;
- `status`.

## Dependencias nativas

O pacote `GDAL` pode exigir instalacao nativa ou Conda, especialmente em Windows. Se o `pip install -r requirements.txt` falhar no GDAL, usar ambiente Conda com GDAL instalado e depois instalar as demais dependencias Python.

## Seguranca

- O bucket continua privado.
- O worker usa `service_role` apenas fora do frontend.
- O app Next valida usuario e `organization_id` antes de acionar o worker.
- O callback tambem exige segredo e atualiza somente o `job_id` da `organization_id` informada.
