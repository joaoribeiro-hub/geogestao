# Portal do Cliente

Fases: `FERRAMENTAS-HUB-1` e `TOOLS-NEXT-PHASES-1`.

Rota interna: `/ferramentas/portal-cliente`.

Rota pública: `/p/[token]`.

## Objetivo

Criar uma página pública segura por serviço para o cliente acompanhar andamento, etapas públicas, progresso, últimas atualizações e documentos liberados.

## Diretrizes

- O cliente não entra no GeoGestão.
- Dados internos de serviço, equipe, financeiro e documentos privados não vazam.
- Documento só aparece no portal se for explicitamente publicado em fase futura.
- Buckets continuam privados; downloads devem usar signed URL temporária.
- O token do portal é longo, aleatório e armazenado no banco apenas como hash.

## Funcional agora

- Painel `Portal do Cliente` dentro do detalhe do serviço.
- API autenticada para publicar/reativar portal e gerar link privado.
- Banco armazena somente `token_hash`; o token original aparece uma vez para copiar.
- Rota pública `/p/[token]` monta um DTO público via `get_public_client_portal`.
- A página pública mostra empresa, cliente, serviço, progresso, etapas e atualizações publicadas.

Migration: `049_tools_next_phases.sql`.

## Próxima fase

- Publicação granular de documentos profissionais do serviço.
- Edição dos campos públicos por etapa, separando texto interno de texto do cliente.
- PIN opcional, expiração visual, QR Code e botão desativar portal.
- Visualização como cliente antes de publicar.
