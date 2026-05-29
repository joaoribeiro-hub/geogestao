# Relatorios

Fase: HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1.

O menu Relatorios fica abaixo de Financeiro e centraliza uma primeira visao operacional das tarefas/checklists da empresa.

Fontes iniciais:

- `daily_checklist_items`;
- `routine_items`.

A tela possui:

- filtros rapidos na lateral: abertas, criadas recentemente, concluidas e pendentes;
- filtros superiores por status, data e membro;
- grafico simples por dia da semana, usando dados reais filtrados;
- tabela com tarefa, responsavel, criador, criacao, conclusao, status e origem.

Status:

- Aberta: `open`;
- Concluida: `done`;
- Excluida: `deleted_at is not null`;
- Arquivada: `archived_at is not null`;
- Todas: registros permitidos pela organizacao.

Tudo e filtrado por `organization_id`. O relatorio ainda prioriza checklists diarios e rotina; etapas de servico ficam preparadas para uma evolucao posterior da consolidacao.

## WORK-TIME-TRACKING-1

Relatorios ganhou a secao "Horas de expediente".

- Diario: usa a data selecionada.
- Semanal: calcula segunda a domingo da semana da data selecionada.
- Mensal: calcula o mes/ano selecionado.

Permissoes:

- owner ve todos os membros ativos da empresa;
- membro/admin operacional ve apenas o proprio relatorio.

Os calculos usam:

- `work_time_days`;
- `work_time_events`;
- jornada em `team_members.expected_minutes_by_weekday`, quando houver `auth_user_id`;
- padrao 5x2 8h quando nao houver jornada;
- `company_holidays` para zerar horas esperadas em feriados.
