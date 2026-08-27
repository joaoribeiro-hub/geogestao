# Deploy dos workers no Render Free

## Arquitetura

O GeoGestao continua sendo o app Next.js. As rotas API do Next chamam os workers Python no Render; o navegador nunca recebe `*_WORKER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` ou qualquer credencial de provedor.

Workers preparados:

| Serviço | Pasta | Porta local | Health |
| --- | --- | ---: | --- |
| BuscaGEO | `workers/buscageo` | 8010 | `/health` |
| Análise Ambiental | `workers/analise-ambiental` | 8020 | `/health` |
| Documentos da Sophia | `workers/sophia-documents` | 8030 | `/health` |

Cada resposta de health contém `status: ok` e `service`. Os três Dockerfiles usam `$PORT` do Render e mantêm uma porta local como fallback.

## Blueprint

O arquivo `render.yaml` na raiz declara os três serviços Docker Free, `rootDir` próprio e `healthCheckPath: /health`. No Render, selecione o repositório e crie o Blueprint. O blueprint usa `sync: false` para variáveis que precisam ser informadas no painel e não contém valores secretos.

O armazenamento local dos workers é efêmero no plano Free. Resultados e entradas devem continuar no Supabase Storage. Caches da Análise Ambiental em `/tmp/ana` podem ser recriados após restart; para a BHO6 e bases grandes, configure uma URL/fonte de cache apropriada ou um volume/plano persistente futuramente.

## Variáveis dos workers no Render

Todos os workers precisam de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, somente no ambiente do worker. Cada serviço também precisa de seu segredo próprio, igual ao segredo configurado no Next:

- BuscaGEO: `BUSCAGEO_WORKER_SECRET`, `BUSCAGEO_STORAGE_BUCKET=documentos`.
- Análise Ambiental: `ANALISE_AMBIENTAL_WORKER_SECRET`, `ANALISE_AMBIENTAL_STORAGE_BUCKET=documentos`, `ANALISE_AMBIENTAL_PROVIDER`, credenciais GEE/MapBiomas e variáveis ANA quando usadas.
- Documentos da Sophia: `SOPHIA_DOCUMENT_WORKER_SECRET`, `SOPHIA_DOCUMENT_STORAGE_BUCKET=documentos`, `SOPHIA_DOCUMENT_OCR_PROVIDER=tesseract`, `SOPHIA_DOCUMENT_OCR_LANGS=por+eng`.

Use um valor aleatório forte para cada `*_WORKER_SECRET`. Não reutilize a `anon key` no lugar da `service role key`, não coloque essas variáveis com prefixo `NEXT_PUBLIC_` e não as grave no Git.

## Variáveis do Next.js/Vercel

No ambiente server-side do app, configure:

```text
BUSCAGEO_WORKER_URL=https://geogestao-buscageo-worker.onrender.com
BUSCAGEO_WORKER_SECRET=<mesmo segredo do worker BuscaGEO>
ANALISE_AMBIENTAL_WORKER_URL=https://geogestao-analise-ambiental-worker.onrender.com
ANALISE_AMBIENTAL_WORKER_SECRET=<mesmo segredo do worker ambiental>
SOPHIA_DOCUMENT_WORKER_URL=https://geogestao-sophia-documents-worker.onrender.com
SOPHIA_DOCUMENT_WORKER_SECRET=<mesmo segredo do worker documental>
```

Mantenha `*_STORAGE_BUCKET=documentos`. As URLs e segredos são lidos somente pelas rotas server-side. O `.env.example` contém apenas nomes/URLs de exemplo; os valores reais devem ser cadastrados no `.env.local` local ou nas Environment Variables da Vercel. Depois de alterar `.env.local`, reinicie o Next.

## Render Free e cold start

O Render Free pode suspender um serviço inativo. O cliente server-side em `src/lib/workers/worker-client.ts` consulta `/health`, aguarda o despertar por até 90 segundos e faz a chamada protegida somente depois que o worker responde. Chamadas simultâneas para o mesmo worker compartilham o health check em andamento. A UI recebe a indicação `Worker acordando no Render Free...` quando a primeira consulta falhou e a seguinte recuperou.

Não há ping infinito, retry no navegador ou segredo no cliente. Falhas depois do limite retornam uma mensagem amigável e não alteram as regras de organização do app.

## Monitoramento no app

Owners e admins podem abrir `/sistema/workers`. A tela mostra apenas URL, se URL/segredo estão configurados, status, serviço e latência do health check. O botão `Testar conexão` testa um worker por vez. Valores de segredo nunca são retornados pela API.

Também é possível verificar publicamente:

```text
https://geogestao-buscageo-worker.onrender.com/health
https://geogestao-analise-ambiental-worker.onrender.com/health
https://geogestao-sophia-documents-worker.onrender.com/health
```

Esses endpoints informam disponibilidade do processo, não substituem a chamada autenticada feita pelo Next.

## Teste local apontando para Render

1. Crie/configure os três serviços no Render e aguarde `Live`.
2. Confirme cada `/health`.
3. No `.env.local` do Next, configure as três URLs públicas e os respectivos `*_WORKER_SECRET`.
4. Reinicie `npm run dev`.
5. Abra `/sistema/workers` como owner/admin e use `Testar conexão`.
6. Execute uma operação real de cada módulo: leitura/cenas do BuscaGEO, processamento da Análise Ambiental e ingestão de um documento da Sophia.
7. Confira os logs do Render e o status do job no GeoGestao.

O primeiro request pode demorar por causa do cold start. Não coloque a URL do Render diretamente em componente client; os módulos continuam chamando suas APIs internas do Next.

## Deploy e troubleshooting

- `502` ou timeout: teste o health, aguarde o cold start e confirme a URL sem barra final.
- `401`: os dois lados estão com segredos diferentes, ou o segredo não foi configurado no worker.
- Health `ok`, mas job falha: verifique `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, bucket e as variáveis específicas do worker nos logs do Render.
- Análise Ambiental sem GEE/ANA: o processo está online, mas o provider real continua indisponível até suas credenciais e bases serem configuradas.
- Sophia sem OCR: o container já instala Tesseract; confira `SOPHIA_DOCUMENT_OCR_LANGS` e o status no health.

## Segurança e escopo

O proxy Next continua validando usuário, organização e permissões antes de chamar o worker. O worker usa a service role apenas server-side para completar o job solicitado; o frontend continua usando a sessão Supabase normal. Não usar reset, não copiar credenciais para o repositório e não transformar bucket privado em público.
