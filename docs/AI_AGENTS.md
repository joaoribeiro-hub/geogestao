# AI Agents

Atualizacao `AGENTS-TASKS-SYNC-FIX-1`:

- o runner dos agentes nao depende de `.single()` nos inserts/updates de `ai_agent_runs`;
- Briefing da manha sempre salva um objeto JSON final com `summary`, `sections`, `tasks`, `reminders`, `services` e `generatedAt`;
- se nao houver tarefas/lembretes, o briefing retorna `Nada urgente para hoje.`;
- Início mostra cards de Briefing da manha e Revisao semanal com o ultimo resultado salvo;
- agente financeiro fica visivel e executavel apenas para owner;
- endpoint protegido `/api/cron/agents/daily-briefing` prepara execucao automatica.

Cron:

- `vercel.json` agenda `0 8 * * *`;
- Vercel Cron usa UTC, entao 08:00 UTC equivale a 05:00 em Brasilia no horario padrao;
- configurar `CRON_SECRET` e chamar com `Authorization: Bearer <CRON_SECRET>`;
- o endpoint evita duplicar run do mesmo agente/organizacao/usuario/data.

Fase: `INTEGRATIONS-AGENTS-TASKS-IMPORT-1`.

Sophia é a assistente conversacional principal. Agentes são rotinas especializadas que leem dados internos pelo backend, respeitam `organization_id` e salvam execuções.

## Agentes iniciais

- Briefing da manhã
- Revisão semanal
- Agente de documentos
- Agente financeiro

## Tabelas

- `ai_agents`
- `ai_agent_runs`
- `ai_agent_deliveries`

## Execução

Nesta fase a execução é manual em Minha Conta > Agentes. O resultado fica em `ai_agent_runs.summary` e também gera notificação interna.

Se `GEMINI_API_KEY` estiver configurada, o backend usa Gemini para redigir o resumo. Sem chave, gera resumo operacional local.

Cron automático fica preparado para fase futura.
