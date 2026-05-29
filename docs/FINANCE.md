# GeoGestao - Financeiro

## Financeiro por servico

Cada servico possui um bloco financeiro visivel apenas para:

- owner da organizacao;
- responsavel principal do servico.

O bloco mostra:

- valor combinado;
- condicao de pagamento;
- valores recebidos;
- valores a receber.

Recebimentos lancados no servico sao gravados em `revenues` com `service_card_id` e aparecem no modulo Financeiro.

## Financeiro por cliente

O detalhe do cliente mostra resumo financeiro dos servicos vinculados:

- valor combinado total;
- valores recebidos;
- valores a receber;
- lista por servico.

## Receita automatica

A receita automatica do servico continua sendo sincronizada pelo status de pagamento e pelo valor previsto/combinado.

Recebimentos manuais do servico usam `auto_generated = false` para evitar duplicidade com a receita automatica.
## HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1

- O Financeiro passa a usar os botoes Nova Entrada, Nova Saida e Nova Transferencia.
- Entrada substitui Receita; Saida substitui Despesa; Transferencia movimenta entre bancos/contas sem alterar lucro.
- Entradas e Saidas ganharam campos de valor previsto, valor realizado, banco/conta e observacoes.
- A tela principal usa tabelas com colunas de nome, valor, banco, vencimento, pagamento e status.
- O dashboard financeiro foi movido para painel lateral, mantendo os indicadores do periodo.
- Recebimentos vinculados a servico continuam refletindo no Financeiro via service_card_id.

## HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1

- Menu Relatorios foi posicionado abaixo de Financeiro.
- Despesas recorrentes de colaboradores continuam sendo criadas/atualizadas quando RH > Colaboradores define valor mensal.
- Documentos de RH nao entram no financeiro; apenas o cadastro do colaborador com valor mensal gera despesa recorrente.
