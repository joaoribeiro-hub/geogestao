# Tarefa e Lembrete

Atualizacao `UI-SOPHIA-ROUTINE-TASKS-1`:

- cada tarefa do widget possui alca de arrastar no lado esquerdo;
- reordenar por drag and drop salva `sort_order` em `daily_checklist_items`;
- quando a tarefa possui item diario vinculado na Rotina, o mesmo `sort_order` e refletido em `routine_items`;
- a aba Lembrete fica limpa por padrao e abre o formulario em `+ Adicionar lembrete`;
- a ordem salva define o primeiro item aberto como trabalho provavel atual para Sophia.

Atualizacao `AGENTS-TASKS-SYNC-FIX-1`:

- item criado no widget Tarefa tambem cria registro vinculado em `routine_items`;
- item diario criado na Rotina continua criando `daily_checklist_items`;
- os dois lados usam `daily_checklist_item_id` para refletir concluir/reabrir/editar/apagar;
- tarefas abertas com `due_date <= hoje` aparecem no widget Tarefa e na Rotina ate serem concluidas, canceladas, arquivadas ou excluidas;
- o widget Tarefa ganhou botoes de editar e apagar por item;
- apagar usa soft delete (`status = canceled` e `deleted_at`) para nao perder rastreabilidade em relatorios.

Fase: `INTEGRATIONS-AGENTS-TASKS-IMPORT-1`.

O antigo widget flutuante `Checklist de hoje` passa a se chamar `Tarefa`.

## Abas

- Tarefa: mantém checklist diário, filtros Hoje/Ontem/Data, emergência, marcação e contadores.
- Lembrete: cria lembretes rápidos na Agenda interna.

## Lembrete rápido

Campos:

- título;
- data;
- horário opcional;
- destinatário da mesma organização;
- preferência de notificação.

Preferências:

- Na data final;
- 10 minutos antes;
- 1 hora antes;
- Não notificar.

Se o destinatário tiver Google Calendar conectado, o backend tenta criar evento no Calendar desse usuário.
