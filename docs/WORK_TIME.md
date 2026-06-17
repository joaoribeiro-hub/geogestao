# Controle de Expediente

## Ajuste KANBAN-UX-THEME-SOPHIA-TIME-1

- O widget do expediente inicia recolhido no topo com o botao `Exibir tempo`.
- Ocultar/exibir o widget nao pausa a contagem.
- O heartbeat server-side foi ajustado para 10 minutos.
- Se a diferenca entre heartbeats ultrapassar 4 ciclos de 10 minutos, o dia e congelado e exige confirmacao.
- O ciclo de seguranca passa a ser de 3 horas, com janela de 15 minutos.
- Em modo `Campo`, o tempo usa calculo server-side continuo e pode contar mesmo se o navegador for fechado ate o retorno/desativacao do modo campo.

Fase: WORK-TIME-TRACKING-1.

O controle de expediente e operacional interno. Nesta fase, ele nao deve ser apresentado como ponto eletronico legal.

## Timer

O topo do app mostra um timer de expediente para o usuario logado.

- Verde: tempo de trabalho contando.
- Amarelo/cinza: intervalo.
- Verde com indicador de campo: saida para campo.
- Vermelho: congelado por falta de confirmacao de seguranca.

O timer inicia automaticamente quando o usuario acessa o app autenticado com organizacao ativa.

## Heartbeat

O frontend envia heartbeat para `/api/work-time` a cada 60 segundos enquanto a pagina esta aberta e visivel.

O backend soma apenas o delta entre `last_seen_at` e o horario do servidor, limitado por uma janela curta. Assim:

- fechar a aba para a contagem no ultimo heartbeat;
- abrir duas abas nao duplica horas;
- reabrir o app inicia nova contagem a partir do novo acesso.

## Seguranca

A cada 2 horas de modo trabalho, o app mostra "Confirmar presenca".

- A janela de confirmacao dura 15 minutos.
- Confirmar dentro da janela registra `safety_confirmed` e reinicia o ciclo.
- Se a janela passar, o dia fica `safety_frozen` e o timer congela.
- Confirmar depois do congelamento retoma a contagem.

O ciclo de seguranca nao roda durante intervalo nem durante saida para campo.

## Intervalo

O botao Intervalo alterna:

- `interval_started`;
- `interval_ended`.

Tempo de intervalo nao conta como trabalho e aparece nos relatorios.

## Saida para campo

O botao Saida para campo alterna:

- `field_started`;
- `field_ended`.

Tempo de campo conta como trabalho, alimenta `total_field_seconds` e desativa temporariamente o ciclo de seguranca.

## Meia-noite

Sem cron real, o fechamento de dias antigos e idempotente ao carregar ou enviar heartbeat no app.

Um dia antigo aberto e encerrado como `closed`, e o novo dia comeca quando o usuario acessa o sistema no novo dia.

## Tabelas

- `work_time_days`
- `work_time_sessions`
- `work_time_events`
- `company_holidays`

Tudo e filtrado por `organization_id` e `user_id`.

## Relatorios

Relatorios de horas ficam em Relatorios > Horas de expediente.

- Owner ve todos os membros ativos da organizacao.
- Admin operacional/membro ve apenas o proprio expediente.
- Diario, semanal e mensal usam a mesma base de calculo.

Campos calculados:

- tempo trabalhado;
- intervalo;
- campo;
- horas exigidas;
- horas faltantes;
- horas extras;
- confirmacoes de seguranca;
- eventos de intervalo e campo.

## Jornada

Minha Empresa > RH > Colaboradores permite configurar:

- escala 5x2;
- escala 6x1;
- personalizada;
- minutos esperados por dia da semana;
- horario padrao de inicio/fim opcional.

Sem configuracao, vale 5x2 com 8h de segunda a sexta.

## Feriados

`company_holidays` guarda feriados globais e da empresa.

- Feriado com `affects_expected_hours = true` zera horas esperadas do dia.
- Se o usuario trabalhar nesse dia, o tempo vira hora extra.
- Feriados aparecem na Agenda como eventos do dia.
