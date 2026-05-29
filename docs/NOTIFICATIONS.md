# GeoGestao - Notificacoes

## Escopo atual

A fase `SERVICE-CLIENT-FINANCE-NOTIFICATIONS-AGENDA-1` adiciona a tabela `notifications` e um sininho no topo do app autenticado.

As notificacoes sao sempre filtradas por:

- `organization_id`;
- `recipient_user_id`.

O usuario so ve notificacoes destinadas a ele.

## Fontes de notificacao

- Prazo de servico faltando 5, 2 ou 1 dia.
- Lembretes/interacoes criados no perfil do cliente.
- Lembretes criados em servicos.
- Lembretes avulsos criados na Agenda.
- Item do checklist diario concluido por membro, notificando o owner.
- Item do `Checklist - Etapas` do servico concluido por membro, notificando o owner.

## Geracao

Sem cron externo nesta fase, notificacoes de prazo e lembretes pendentes sao geradas de forma idempotente ao carregar `/api/notifications`.

Cada notificacao usa `dedupe_key` com chave logica por organizacao, destinatario, entidade e tipo para evitar duplicacao infinita.

## Lembretes

Quando um lembrete/interacao e criado com data de hoje, o app cria imediatamente:

- `reminder_due_today`.

Se o lembrete tiver horario, o app tambem prepara:

- `reminder_two_hours_before`;
- `reminder_one_hour_before`;
- `reminder_due_now`.

Essas notificacoes ficam com `scheduled_for` no horario correto. O sininho mostra apenas notificacoes com `scheduled_for` vazio ou menor/igual ao momento atual.

Regra adotada:

- se o lembrete for criado dentro da janela de 2h ou 1h, essas notificacoes ja ficam visiveis;
- se o horario exato ainda nao chegou, `reminder_due_now` so aparece quando chegar;
- se o horario ja passou, `reminder_due_now` aparece ao sincronizar.

## Timezone

Datas e horarios de lembrete sao interpretados no fuso `America/Sao_Paulo`.

Campos `date` e `time` da UI sao convertidos para `scheduled_for` com offset `-03:00`, evitando que um lembrete de hoje caia em ontem/amanha por UTC.

## Sem cron

Sem job de fundo, notificacoes futuras sao sincronizadas quando:

- o usuario abre o sininho;
- o app faz polling leve do sininho enquanto esta aberto;
- a Agenda e carregada e o sininho consulta `/api/notifications`.

## Leitura

Ao clicar em uma notificacao no sininho, o app marca `read_at` e navega para a origem quando `action_url` estiver preenchida.

Rotas internas usadas:

- cliente: `/clientes/[id]`;
- servico: `/servicos/[id]`;
- Agenda: `/agenda?month=YYYY-MM`;
- checklist diario: `/?checklist=today`, ate existir deep link dedicado do painel flutuante.

`action_url` aceita apenas rotas internas iniciadas por `/`; URLs externas sao descartadas no helper server-side.

Cada notificacao tambem tem um botao `X`. Esse botao apenas marca a notificacao como lida, remove do dropdown de nao lidas e reduz o badge, sem apagar definitivamente o registro.

## Texto

O titulo identifica a janela, por exemplo `Lembrete para hoje`.

A mensagem nao repete o titulo. Ela deve trazer contexto curto da origem:

- cliente: `Cliente Almeida: Retornar ligacao. Horario: 18:32.`;
- servico: `Servico Jucara: Conferir documentacao. Horario: 18:32.`;
- Agenda: `Reuniao com equipe. Horario: 18:32.`.

Textos longos sao truncados na UI para preservar o layout do sininho.
## HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1

- Itens de Checklist - Etapas com data/horario usam o helper central de lembretes.
- Rotina com data/horario tambem usa o helper central de notificacoes.
- Membro adicionado a um servico recebe notificacao de projeto.
- Usuario definido como responsavel principal de servico recebe notificacao de projeto.
- Sem cron real, notificacoes futuras e recorrentes sao sincronizadas quando o usuario acessa o app, abre o sininho ou abre telas operacionais.

## HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1

O Inicio consome `/api/notifications?includeRead=true|false`.

- `includeRead=false` e o comportamento padrao para listar apenas nao lidas.
- `includeRead=true` retorna recentes lidas e nao lidas, ainda filtradas por `recipient_user_id`, `organization_id` e `scheduled_for <= now()`.
- O backend mapeia as notificacoes em grupos de UI:
  - `mentions`: atribuicoes, responsavel, membro adicionado, destino direto;
  - `projects`: servicos, projetos e clientes;
  - `notes`: checklist, rotina, lembretes avulsos e demais notas.
- O botao X no Inicio reutiliza a rota `PATCH /api/notifications/[id]/read` e nao apaga o registro.
- A deduplicacao continua baseada em `dedupe_key`; notificacoes fechadas no sininho ou no Inicio nao reaparecem como nao lidas.

## WORK-TIME-TRACKING-1

O congelamento do timer por falta de confirmacao de seguranca fica registrado em `work_time_events` como `safety_timeout_frozen`.

Notificacoes automáticas para congelamento/horas extras ficam opcionais nesta fase; o essencial e o timer visivel e o relatorio operacional.
