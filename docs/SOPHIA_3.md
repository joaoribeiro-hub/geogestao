# Sophia 3.0

## Estado

A Sophia 3.0 adiciona um core cognitivo incremental sem remover `/api/sophia/chat` nem `/api/assistant`.

O fluxo registrado pelo runtime e:

`receive_input -> retrieve_context -> retrieve_memories -> retrieve_documents -> plan_action -> decide_tool -> confirmation -> execute_tool -> verify_result -> reflect -> respond`

O estado da execucao e tipado em `src/lib/sophia/v3/cognitive-state.ts` e anexado ao output de `sophia_runs` quando uma tool e executada.

## Tools e plano multi-etapas

O catalogo continua sendo a fonte de verdade. Gemini ou um provider compativel pode escolher somente tools registradas. Ate tres steps somente de leitura podem ser executados em sequencia; qualquer escrita continua isolada e exige confirmacao humana.

Skills operacionais ficam em `src/lib/sophia/v3/skill-library.ts` e no catalogo `sophia_skills`.

## Eventos proativos

Insercoes em `organization_activity_log` geram eventos pendentes por trigger SQL. O endpoint protegido `/api/cron/sophia/events` processa a fila a cada cinco minutos no Vercel Cron e registra memoria episodica por organizacao. O processamento nao executa escrita de negocio automaticamente e nao envia dados entre empresas.

## Agentes

O cron de agentes usa `runSophiaAgentPipeline`: documentos alimenta o contexto operacional, depois rodam briefing/revisao e, na segunda-feira, financeiro somente para owner.

## Limites

Nao ha autonomia para acao sensivel, memoria global automatica ou modelo local embutido. Todas as acoes de escrita continuam no registry server-side e passam por permissao/confirmacao.

