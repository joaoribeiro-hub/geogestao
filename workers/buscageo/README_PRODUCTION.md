# BuscaGEO Worker em Produção

O worker BuscaGEO é um serviço FastAPI separado do app Next.js/Vercel. Ele executa as rotinas pesadas de GDAL/OGR, busca STAC CBERS, recortes, previews e mosaico.

## Endpoints

- `GET /health`: retorna `{"status":"ok"}`.
- `POST /jobs/{job_id}/read-geometry`
- `POST /jobs/{job_id}/search-scenes`
- `POST /jobs/{job_id}/process`

As rotas `POST` exigem header:

```http
Authorization: Bearer <BUSCAGEO_WORKER_SECRET>
```

## Variáveis do worker

Configure no Railway, Render, Fly ou VPS:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
BUSCAGEO_WORKER_SECRET=um-segredo-forte-igual-ao-da-vercel
BUSCAGEO_STORAGE_BUCKET=documentos
BUSCAGEO_CBERS_COLLECTION=CB4A-WPM-PCA-FUSED-1
BUSCAGEO_START_DATETIME=2023-03-01T00:00:00Z
BUSCAGEO_MAX_PREVIEW_SCENES=5
PORT=8010
```

`SUPABASE_SERVICE_ROLE_KEY` fica somente no worker. Nunca coloque essa chave no frontend ou em variável `NEXT_PUBLIC_*`.

## Variáveis na Vercel

Configure no projeto GeoGestao:

```env
BUSCAGEO_WORKER_URL=https://url-publica-do-worker
BUSCAGEO_WORKER_SECRET=mesmo-segredo-do-worker
BUSCAGEO_STORAGE_BUCKET=documentos
```

Localmente:

```env
BUSCAGEO_WORKER_URL=http://127.0.0.1:8010
BUSCAGEO_WORKER_SECRET=mesmo-segredo-do-worker-local
BUSCAGEO_STORAGE_BUCKET=documentos
```

## Build Docker

Na pasta `workers/buscageo`:

```bash
docker build -t buscageo-worker .
docker run --rm -p 8010:8010 \
  -e SUPABASE_URL="https://seu-projeto.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e BUSCAGEO_WORKER_SECRET="..." \
  -e BUSCAGEO_STORAGE_BUCKET="documentos" \
  buscageo-worker
```

Teste:

```bash
curl http://127.0.0.1:8010/health
```

## Railway

1. Crie um novo serviço a partir do repositório.
2. Configure o root directory como `workers/buscageo`.
3. Railway deve detectar o `Dockerfile`.
4. Configure as variáveis do worker.
5. Depois do deploy, copie a URL pública e coloque em `BUSCAGEO_WORKER_URL` na Vercel.

## Render

1. Crie um Web Service.
2. Escolha ambiente Docker.
3. Root directory: `workers/buscageo`.
4. Configure as variáveis do worker.
5. Health check path: `/health`.
6. Copie a URL pública para `BUSCAGEO_WORKER_URL` na Vercel.

## Fly.io

Exemplo:

```bash
cd workers/buscageo
fly launch --dockerfile Dockerfile
fly secrets set SUPABASE_URL="https://seu-projeto.supabase.co"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="..."
fly secrets set BUSCAGEO_WORKER_SECRET="..."
fly secrets set BUSCAGEO_STORAGE_BUCKET="documentos"
fly deploy
```

## VPS

```bash
cd workers/buscageo
docker build -t buscageo-worker .
docker run -d --restart unless-stopped --name buscageo-worker \
  -p 8010:8010 \
  --env-file .env.production \
  buscageo-worker
```

Em produção, prefira expor via HTTPS com proxy reverso como Caddy, Nginx ou Traefik.

## Observações

- Os arquivos `.bat` continuam apenas para desenvolvimento local no Windows.
- Em produção, o start é:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8010}
```

- Quando o worker estiver online e `BUSCAGEO_WORKER_URL` estiver correto na Vercel, o módulo `/modulos/buscageo` não deve ficar em `worker_pending`.
