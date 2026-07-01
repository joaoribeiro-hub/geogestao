# BuscaGEO Worker

Worker FastAPI para processamento pesado do modulo BuscaGEO do GeoGestao.

Ele nao roda o app local antigo nem arquivos `.bat`. A camada nova recebe jobs do GeoGestao, baixa o arquivo do Supabase Storage privado, reaproveita a logica auditada de GDAL/OGR/STAC/CBERS e devolve atualizacoes pelo callback server-side do app.

## Variaveis

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
BUSCAGEO_WORKER_SECRET=
BUSCAGEO_STORAGE_BUCKET=documentos
```

No app Next.js:

```env
BUSCAGEO_WORKER_URL=http://localhost:8010
BUSCAGEO_WORKER_SECRET=
BUSCAGEO_STORAGE_BUCKET=documentos
```

`SUPABASE_SERVICE_ROLE_KEY` fica apenas no worker/server. Nunca use no frontend.

## Rodar localmente

```bash
cd workers/buscageo
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8010
```

GDAL precisa estar instalado de forma compativel com o ambiente Python. Em Windows, prefira ambiente Conda quando o wheel do GDAL nao estiver disponivel.
