# Quota de armazenamento

Fase: `DOCUMENTS-STORAGE-ARCH-1`.

## Campos

`organizations` passa a controlar:

- `storage_quota_bytes`;
- `storage_used_bytes`;
- `storage_reserved_bytes`.

Quota padrao: 1 GB por organizacao, com backfill a partir de `storage_quota_mb` quando existir.

## Reserva

Antes do upload, o app chama a RPC:

```sql
public.reserve_document_storage(p_organization_id, p_size_bytes)
```

Ela e transacional e so reserva se:

```text
used + reserved + incoming <= quota
```

## Confirmacao

Depois que o arquivo chega ao Storage, o app chama:

```sql
public.confirm_document_storage(p_organization_id, p_size_bytes)
```

Isso reduz `storage_reserved_bytes` e aumenta `storage_used_bytes`.

## Cancelamento e remocao

Falha de upload:

```sql
public.release_document_storage(...)
```

Documento removido:

```sql
public.remove_document_storage(...)
```

## UI

O painel profissional de documentos bloqueia o upload quando a quota estoura e mostra:

```text
Sua empresa atingiu o limite de armazenamento do plano atual.
```

Minha Conta ainda pode exibir a quota antiga em MB; a consolidacao visual completa para bytes fica preparada.

