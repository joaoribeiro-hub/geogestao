# Rotina

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
