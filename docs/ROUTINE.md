# Rotina

Atualizacao `UI-SOPHIA-ROUTINE-TASKS-1`:

- itens diarios possuem `sort_order` para preservar a ordem definida pelo usuario;
- a Rotina diaria ordena primeiro por `sort_order` e depois por criacao;
- a mesma ordem e usada pelo widget Tarefa, Inicio, Relatorios e respostas da Sophia;
- ao criar item de Rotina, campos de titulo e descricao aceitam mencoes com `@`;
- sugestoes de mencao mostram apenas membros ativos da mesma organizacao;
- mencoes salvas criam registros em `routine_item_mentions` e notificacoes internas para os mencionados.

Atualizacao `AGENTS-TASKS-SYNC-FIX-1`:

- Rotina diaria e widget Tarefa passaram a compartilhar os mesmos itens por vinculo entre `routine_items.daily_checklist_item_id` e `daily_checklist_items.id`;
- a visao diaria da Rotina mostra itens abertos de dias anteriores enquanto nao forem concluidos/cancelados;
- concluir/reabrir na Rotina sincroniza o item do widget Tarefa;
- editar/apagar no widget Tarefa sincroniza a Rotina;
- essa regra evita depender apenas de copia pontual no dia da criacao.

Fase: HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1.

O menu Rotina centraliza planejamento diario, semanal, mensal e anual.

Implementacao atual:

- visao da semana atual com navegacao para semana anterior, atual e proxima;
- itens diarios por data;
- secoes Rotina Semanal, Rotina Mensal e Rotina Anual;
- item diario criado na Rotina tambem cria item no Checklist de Hoje da data correspondente;
- marcar/desmarcar item de rotina sincroniza o item diario vinculado quando existir;
- itens com data e horario geram notificacoes usando o helper central de lembretes.

Sem cron real:

- migracao automatica de itens nao concluidos para o dia seguinte deve ser feita de forma idempotente ao carregar o app em fase futura;
- notificacoes futuras sao sincronizadas quando o usuario acessa o app/sininho/agenda.
