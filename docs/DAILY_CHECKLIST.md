# Checklist Diario

## Conceito

O Checklist Diario e um painel flutuante por usuario e por data.

Cada organizacao tem seus proprios checklists e atividades. Usuario de outra organizacao nao acessa esses dados.

## Tabelas

- `daily_checklists`: um checklist por `organization_id`, `user_id` e data.
- `daily_checklist_items`: itens do checklist, com status, emergencia, criador, responsavel e conclusao.
- `organization_activity_log`: registro interno de atividades da empresa.

## Uso

O painel flutuante permite:

- filtrar Hoje, Ontem ou data personalizada;
- adicionar item;
- marcar/desmarcar concluido;
- marcar/desmarcar emergencia;
- consultar dias anteriores.

Itens de emergencia aparecem destacados.

## Badges do botao flutuante

O botao flutuante do Checklist mostra contadores do dia atual do usuario logado:

- badge normal: quantidade de itens `open` do checklist de hoje;
- badge vermelho: quantidade de itens `open` atribuidos pelo owner/proprietario;
- itens `done` ou `canceled` nao entram na contagem;
- ao concluir, reabrir ou criar item, o widget recarrega os contadores.

O badge vermelho considera `source = 'owner_assignment'` ou item criado por usuario com role `owner` na mesma organizacao.

## Atribuicao por owner

O owner pode usar o Assistente IA para criar item no checklist de outro membro.

Admins operacionais criam e atualizam os proprios itens, mas nao atribuem tarefas para outros membros nesta fase.

## Activity log

As principais acoes registram eventos:

- `checklist_item_created`;
- `checklist_item_completed`;
- `checklist_item_reopened`;
- `checklist_item_emergency_marked`;
- `checklist_item_emergency_unmarked`;
- `checklist_item_assigned`;
- `service_created_by_assistant`;
- `assistant_feedback_positive`;
- `assistant_feedback_negative`.

O Assistente IA pode consultar checklist e atividades da organizacao atual para responder perguntas como:

- "O que eu programei para hoje?"
- "O que eu fiz hoje?"
- "O que Joao esta fazendo agora?"

## Atividade atual de membro

Para responder "o que ele esta fazendo agora", o assistente usa o checklist do membro na data solicitada:

1. ordena itens por criacao;
2. lista itens `done`;
3. identifica o ultimo concluido;
4. escolhe o primeiro item `open` depois dele;
5. se nao houver concluido, usa o primeiro `open`;
6. se nao houver aberto, informa que nao ha item em andamento.

O contexto da conversa guarda o ultimo membro citado, entao perguntas seguintes com "ele", "ela" ou "esse membro" continuam apontando para o mesmo usuario da organizacao.
## HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1

- Rotina diaria criada no menu Rotina cria item correspondente no Checklist de Hoje da data selecionada.
- Marcar/desmarcar item de rotina sincroniza o item diario vinculado quando houver vinculo.
- A migracao automatica de itens nao concluidos para o dia seguinte fica preparada para evolucao idempotente sem cron real.
