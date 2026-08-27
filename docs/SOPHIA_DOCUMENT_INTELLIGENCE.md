# Sophia: inteligencia documental

## Arquitetura

A leitura documental segue o fluxo `upload -> processamento explícito -> extração local -> OCR sob demanda -> chunks -> busca citável`. Os arquivos continuam no bucket privado `documentos`; `documents`, `document_extracted_pages`, `document_chunks` e `document_ai_summaries` guardam somente metadados e resultados.

O worker Python em `workers/sophia-documents` usa `SUPABASE_SERVICE_ROLE_KEY` apenas no próprio processo de infraestrutura. O Next.js não recebe essa chave e não a envia ao navegador.

## Formatos

- PDF: PyMuPDF tenta texto nativo página a página; OCR Tesseract só é acionado quando a página tem pouco texto.
- DOCX: `python-docx` extrai parágrafos, títulos básicos e tabelas em Markdown.
- JPG/PNG/WebP: Pillow normaliza a imagem e Tesseract faz OCR.
- TXT/CSV/MD: leitura local com fallback de encoding.

O limite padrão é 50 MB e o limite de páginas é 150. PaddleOCR e OCR pesado ficam preparados como evolução, mas não são ativados por padrão.

## Busca e Sophia

`document_chunks` recebe texto, página, ordem, hash e método de extração. A tool `document_search` retorna trechos com documento e página; `document_answer` usa esses trechos e funciona sem Gemini. Gemini é opcional, server-side e deve receber somente trechos relevantes, nunca o arquivo inteiro por padrão.

Toda criação de memória permanente, vínculo ou outra escrita deve continuar passando por confirmação humana. A busca e o processamento respeitam `organization_id`.

## Configuração local

No `.env.local` do Next:

```text
SOPHIA_DOCUMENT_WORKER_URL=http://127.0.0.1:8030
SOPHIA_DOCUMENT_WORKER_SECRET=mesmo-valor-seguro-no-worker
```

No ambiente do worker, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SOPHIA_DOCUMENT_WORKER_SECRET`, `SOPHIA_DOCUMENT_STORAGE_BUCKET=documentos` e `SOPHIA_DOCUMENT_OCR_LANGS=por+eng`. A chave de serviço nunca deve ser adicionada ao `.env` público nem a `NEXT_PUBLIC_*`.

Execute `setup-sophia-documents-worker.bat` uma vez e depois `iniciar-sophia-documents-worker.bat`. Teste `GET http://127.0.0.1:8030/health`.

## Uso

1. Envie o arquivo em `/sophia/inbox` ou anexe no chat.
2. Clique em `Processar documento`.
3. Consulte o tipo, páginas, chunks e erro no resultado.
4. Pergunte à Sophia sobre o documento; respostas baseadas em chunks exibem documento e página.

Sem `SOPHIA_DOCUMENT_WORKER_URL` e `SOPHIA_DOCUMENT_WORKER_SECRET`, o upload continua funcionando e a interface mostra uma mensagem orientando a configuração, sem falhar silenciosamente.

## Render Free

O container em `workers/sophia-documents` instala Tesseract, idiomas português/inglês e utilitários de PDF. A porta usa `PORT` do Render, com fallback local `8030`, e `GET /health` informa `service: sophia-documents`. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SOPHIA_DOCUMENT_WORKER_SECRET` somente no Render. No Next, use a URL pública e o mesmo segredo em variáveis server-side. O cliente compartilhado aguarda cold start antes de iniciar a ingestão.
# Integracao Sophia 4

A Sophia 4 usa o mesmo `document_chunks` e o mesmo worker. O Self-RAG V4 aplica as etapas recuperar, graduar relevancia/suporte, citar e recusar quando nao existe evidencia suficiente. Cada citacao informa documento, pagina, chunk, trecho curto e se a origem foi OCR.
