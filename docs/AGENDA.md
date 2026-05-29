# GeoGestao - Agenda

## Escopo atual

A Agenda centraliza lembretes e prazos da organizacao atual em um calendario mensal visual.

Ela mostra:

- data inicial dos servicos;
- data prevista/final dos servicos;
- lembretes avulsos;
- lembretes criados a partir de interacoes de servico.

## Calendario mensal

A rota `/agenda` abre no mes atual por padrao.

Tambem aceita URL com mes:

```text
/agenda?month=2026-05
```

Controles disponiveis:

- mes anterior;
- mes atual;
- proximo mes.

Cada dia aparece em uma celula da grade domingo-sabado. Eventos aparecem dentro do dia correspondente com tipo curto:

- `Servico`;
- `Prazo`;
- `Lembrete`;
- `Cliente`.

Ao clicar em um item, o app abre um detalhe rapido com link para abrir servico ou cliente quando houver vinculo.

Ao clicar em um dia vazio ou no botao `Adicionar lembrete`, o app abre modal de lembrete ja com a data preenchida.

O calendario usa layout compacto: celulas menores, menos espacamento interno e lista de eventos com rolagem dentro do dia quando houver muitos itens. A decisao reduz a altura visual da Agenda sem remover a leitura por mes.

## Lembretes avulsos

O owner pode criar lembretes para membros da empresa.

Admin operacional cria lembretes para si mesmo nesta fase.

Ao criar lembrete, o app grava:

- `agenda_reminders`;
- `agenda_reminder_recipients`;
- `notifications`.

Lembretes da Agenda usam a mesma regra central de notificacoes:

- aviso do dia;
- aviso de 2 horas antes;
- aviso de 1 hora antes;
- aviso no horario.

## Isolamento

Todas as consultas usam `organization_id`.
## HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1

- A Agenda passa a suportar categorias: Reuniao interna, Reuniao com clientes, Servicos e Outro.
- Owner tambem pode usar categorias especiais: Comercial, Financeiro, Marketing e R.H.
- Lembretes podem repetir semanalmente. As ocorrencias sao calculadas na leitura do calendario, sem criar infinitos registros fisicos.
- O criador do lembrete pode editar ou apagar/cancelar o lembrete.
- Lembretes cancelados deixam de aparecer na Agenda; notificacoes futuras associadas sao marcadas como lidas.
- Etapas de servico com data aparecem como eventos da Agenda.

## WORK-TIME-TRACKING-1

Feriados de `company_holidays` aparecem na Agenda como eventos `Feriado`.

- Feriados globais possuem `organization_id = null`.
- Feriados da empresa usam `organization_id` da organizacao.
- `affects_expected_hours = true` reduz a jornada esperada do dia nos relatorios de horas.
- A Agenda mostra o feriado como informativo, sem notificar todos por padrao.
