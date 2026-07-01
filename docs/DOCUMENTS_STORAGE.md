# Documentos profissionais

Fase: `DOCUMENTS-STORAGE-ARCH-1`.

## Arquitetura

O GeoGestao passa a ter uma camada profissional de documentos na tabela `documents`, sem apagar `attachments`, `document_templates`, `property_documents` ou `hr_documents` existentes.

O armazenamento principal dos novos documentos e o Supabase Storage no bucket privado:

- `documentos`

O bucket e do tipo Files, privado, com limite de 50 MB por arquivo e MIME types permitidos para PDF, imagens, DOC/DOCX, TXT e planilhas.

## Paths

Todos os arquivos de empresa precisam iniciar com:

```text
organizations/{organization_id}/
```

Padroes usados:

```text
organizations/{organization_id}/clients/{client_id}/properties/{property_id}/documents/{document_id}/{safe_filename}
organizations/{organization_id}/clients/sem_cliente/properties/sem_imovel/documents/{document_id}/{safe_filename}
organizations/{organization_id}/services/{service_id}/documents/{document_id}/{safe_filename}
organizations/{organization_id}/documents/{document_id}/{safe_filename}
organizations/{organization_id}/hr/{employee_id}/documents/{document_id}/{safe_filename}
organizations/{organization_id}/modules/buscageo/{job_id}/input/{safe_filename}
organizations/{organization_id}/modules/buscageo/{job_id}/preview/{safe_filename}
organizations/{organization_id}/modules/buscageo/{job_id}/output/{safe_filename}
```

O frontend nunca envia path arbitrario. O servidor gera `document_id`, sanitiza o nome e monta o path.

Para BuscaGEO, a migration `047_buscageo_real_integration.sql` amplia os MIME types do bucket `documentos` para KML, KMZ, ZIP, TIFF/GeoTIFF e `application/octet-stream`, mantendo o bucket privado.

## Upload

Fluxo:

1. Frontend valida tamanho e MIME.
2. `POST /api/documents/prepare-upload` valida usuario, organizacao, vinculos, quota e cria `documents.upload_status = aguardando_upload`.
3. O backend reserva quota em `organizations.storage_reserved_bytes`.
4. O frontend envia para Storage autenticado no bucket `documentos`.
5. `POST /api/documents/confirm-upload` muda para `upload_status = enviado`, `processing_status = pendente`, move reserved para used e cria job em `document_processing_jobs`.
6. Falha antes de confirmar pode chamar `POST /api/documents/cancel-upload`.

## Download

Download usa:

```text
GET /api/documents/{id}/download
```

A rota valida `organization_id`, `deleted_at` e permissao antes de criar signed URL de 5 minutos. O bucket nunca e publico.

## Busca

Busca Fase 1:

```text
GET /api/documents/search
```

Filtros suportados:

- termo `q`;
- `client_id`;
- `property_id`;
- `service_id`;
- `employee_id`;
- `related_type`;
- `document_type`;
- `processing_status`;
- `upload_status`.

A busca consulta metadados e `extracted_text` quando existir. `document_chunks` fica preparado para processamento textual.

## RLS

Regras:

- membros ativos leem/criam/atualizam documentos da propria `organization_id`;
- chunks e jobs tambem respeitam `organization_id`;
- documentos globais podem ser lidos quando `is_global = true`;
- usuarios comuns nao criam/removem globais;
- Storage policy limita paths `organizations/{organization_id}/...` ao membro ativo da organizacao.

## Compatibilidade

O sistema legado continua existindo:

- `attachments`: anexos genericos atuais;
- `document_templates`: biblioteca/modelos;
- `hr_documents`: documentos reais do RH da fase anterior;
- `property_documents`: base GeoQuery, sem alteracao.

A migracao automatica desses registros para `documents` fica para fase futura e deve ser feita sob demanda.
