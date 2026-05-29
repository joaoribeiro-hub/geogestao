# Processamento de documentos

Fase: `DOCUMENTS-STORAGE-ARCH-1`.

## Fila

Ao confirmar upload, o app cria um registro em:

```text
document_processing_jobs
```

Payload:

- `document_id`;
- `organization_id`;
- `storage_bucket`;
- `storage_path`;
- `mime_type`;
- tentativa.

Essa tabela funciona como fila inicial segura. Supabase Queues/pgmq, pg_cron e pg_net podem ser ativados futuramente no Dashboard do Supabase se o projeto optar por fila gerenciada.

## Worker

Foi criado o esqueleto:

```bash
npx tsx scripts/documents/process-document-jobs.ts
```

Esse script e server/admin e usa `SUPABASE_SERVICE_ROLE_KEY` apenas fora do frontend.

## Fase 1

Busca por metadados e `extracted_text` ja existente.

## Fase 2

Extracao automatica:

- TXT ja tem helper real;
- PDF com texto e DOCX ficam preparados para biblioteca propria;
- chunks sao salvos em `document_chunks`.

## Fase 3

OCR para imagens e PDFs escaneados.

Nesta fase, imagens sao classificadas como:

```text
processing_status = precisa_ocr
```

Sem OCR pesado dentro do Postgres.

## Cron e limpeza

Sem cron real nesta entrega. Recomendacoes futuras:

- limpeza de `aguardando_upload` com mais de 2 horas;
- liberar reservas antigas;
- processar jobs pendentes em intervalo curto;
- retentar jobs com erro controlado.

