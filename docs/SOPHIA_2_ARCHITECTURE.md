# Sophia 2.0

Sophia 2.0 evolui a assistente do GeoGestao para uma camada operacional com orquestrador, contexto, tools reais, permissões, confirmação humana e auditoria.

## Estrutura

- `/api/sophia/chat`: endpoint principal da Sophia 2.0.
- `/api/assistant`: rota legada preservada para compatibilidade.
- `src/lib/sophia/tool-registry.ts`: registry central de tools reais.
- `src/lib/sophia/context.ts`: resolução de contexto da tela, cliente, serviço, mensagens, memórias e documentos.
- `src/lib/sophia/permissions.ts`: gate de permissões e disponibilidade por módulo.
- `src/lib/sophia/runner.ts`: execução, confirmação, auditoria e eventos.
- `/api/sophia/inbox`: caixa de entrada universal de arquivos.

## Tools Reais

A Sophia reaproveita actions existentes por adapters:

- serviços de hoje/mês/atrasados;
- criação de serviço;
- conclusão de etapa do serviço;
- tarefas e checklist diário;
- busca/resumo/interações de clientes;
- busca de documentos;
- listagem de ferramentas;
- jobs BuscaGEO;
- jobs de Análise Ambiental.

Não há tools falsas. Funcionalidades sem backend real ficam fora do registry até existirem.

## Function Calling

O planejamento usa duas camadas:

1. interpretador local determinístico para intents já conhecidas;
2. Gemini, quando `GEMINI_API_KEY` estiver configurada, apenas para escolher uma tool registrada.

Mesmo quando Gemini escolhe uma tool, o backend valida permissões e executa somente handlers server-side.

## Confirmação Humana

Tools com risco `internal_write`, `external_write` ou `destructive` exigem confirmação antes de executar. A confirmação é registrada em `sophia_pending_actions`.

## Memória e RAG

Memórias operacionais ficam em `sophia_memories`. Documentos usam `documents`, `document_extracted_pages` e `document_chunks`; a Sophia pode consultar trechos citáveis com documento e página. A extração/OCR local fica no worker separado descrito em `docs/SOPHIA_DOCUMENT_INTELLIGENCE.md`.

## Caixa de Entrada Universal

Arquivos enviados para a caixa de entrada vão para o bucket privado `documentos` em:

`organizations/{organization_id}/sophia-inbox/{inbox_item_id}/{safe_filename}`

O registro fica em `sophia_inbox_items` com classificação inicial por nome/MIME e status `needs_confirmation`.

## Eventos, Jobs e Auditoria

- `sophia_runs`: uma execução da Sophia.
- `sophia_tool_calls`: chamada de tool com input/output e verificação.
- `sophia_events`: eventos processáveis.
- `assistant_action_logs`: log legado mantido para continuidade.

## Controle de Acesso

`organization_modules` ganhou `access_state` e `billing_mode`. Os módulos atuais permanecem livres (`free`) e a cobrança futura fica separada do status operacional (`beta`, `worker_pendente`, etc.).

## Variáveis

- `GEMINI_API_KEY`: já existente.
- `GEMINI_AGENT_MODEL`: opcional para Sophia 2.0.
- `GEMINI_MODEL`: fallback já existente.

Não usar `NEXT_PUBLIC` para chaves de modelo.
