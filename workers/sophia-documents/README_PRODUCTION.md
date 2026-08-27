# Worker documental da Sophia

O worker usa `SUPABASE_SERVICE_ROLE_KEY` somente no processo Python. Essa variável nunca deve existir no frontend ou em `NEXT_PUBLIC_*`.

## Local

1. Instale Python 3.11+ e Tesseract OCR.
2. Para documentos em portugues, instale o pacote de idioma `por` do Tesseract e, se necessário, defina `TESSDATA_PREFIX`.
3. Copie as variáveis abaixo para o ambiente do worker:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SOPHIA_DOCUMENT_WORKER_SECRET=
SOPHIA_DOCUMENT_STORAGE_BUCKET=documentos
SOPHIA_DOCUMENT_OCR_PROVIDER=tesseract
SOPHIA_DOCUMENT_OCR_LANGS=por+eng
SOPHIA_DOCUMENT_MAX_PAGES=150
SOPHIA_DOCUMENT_MAX_FILE_MB=50
SOPHIA_DOCUMENT_ENABLE_GEMINI=false
GEMINI_API_KEY=
```

4. Rode `uvicorn main:app --host 127.0.0.1 --port 8030` nesta pasta.
5. Teste `GET http://127.0.0.1:8030/health`.

PDF textual usa PyMuPDF. Paginas com pouco texto tentam OCR apenas naquela pagina. DOCX usa `python-docx`, imagens usam Pillow + Tesseract e TXT/CSV/MD usam decodificacao local.
