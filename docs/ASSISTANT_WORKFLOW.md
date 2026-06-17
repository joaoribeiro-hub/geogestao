# Assistente IA - Workflow Operacional

## Sophia - status atual de membro

Na fase `KANBAN-UX-THEME-SOPHIA-TIME-1`, a Sophia resolve membros por nome completo, primeiro nome, email, prefixo de email, variacoes sem acento/caixa e pequenos erros de digitacao.

Perguntas como `O que a Natalia esta fazendo agora?` usam os itens do checklist/tarefa do dia dentro da `organization_id` atual:

- itens concluidos aparecem em bullets;
- o primeiro item aberto pela ordem atual e tratado como trabalho provavel;
- a ultima atividade registrada entra na resposta quando existir;
- a resposta usa Markdown com nomes, itens, datas e horarios em destaque.

## Feedback global

Correcoes feitas pelo feedback continuam sendo salvas em `assistant_feedback` e tambem podem gerar exemplos em `assistant_feedback_examples`, tabela global sanitizada criada na migration `043`. Esses exemplos orientam comportamento/formato de intent, sem reutilizar dados privados de uma organizacao em outra.

## Conceito

O Assistente IA deixou de ser item principal do menu lateral e passa a ser acesso flutuante global no app autenticado.

Ele usa a rota server-side `/api/assistant`, detecta intencoes por interpretador local primeiro e chama Gemini apenas quando a confianca local e baixa.

## Escritas

Toda escrita precisa passar pela action registry. O assistente nao executa SQL livre e nao afirma que criou algo antes da action server-side concluir.

Intencoes de escrita, como criar servico, criar tarefa, criar interacao e criar item de checklist, exigem confirmacao visual antes de gravar.

## Criar servico

Frases como:

```text
crie um servico de georreferenciamento para o imovel Jucara com prazo de um mes e valor 1.200,50
```

sao classificadas como `create_service`, com parametros de tipo, imovel, prazo, valor, prioridade e pagamento. O servico nasce na coluna inicial do fluxo do tipo informado e registra activity log.

O detector local so escolhe `create_service` quando ha pedido claro de servico, como "crie um servico", "novo servico" ou "servico para o imovel". Palavras como cartorio, matricula, documento, cliente ou imovel nao bastam para criar servico se a frase fala em tarefa, lembrete ou membro.

## Tarefa para membro

Frases como:

```text
crie uma tarefa para o membro Natalia Silva: ligar para o cartorio
```

sao classificadas como `create_member_task` e usam a action segura de atribuir item ao checklist do membro. O servidor busca o membro dentro da organizacao atual; se houver mais de um resultado, pede escolha; se houver um unico membro, pede confirmacao antes de gravar.

## Feedback supervisionado

Apos respostas do assistente, o chat mostra:

```text
Essa resposta esta correta?
```

O feedback positivo ou negativo e salvo em `assistant_feedback`, com `organization_id`, `user_id`, mensagem original, resposta, intent, fonte e correcao quando houver.

Feedback negativo fica salvo bruto em `assistant_feedback` com `organization_id` e contexto da conversa. A partir dele, o servidor cria tambem um exemplo global sanitizado em `assistant_global_learning_examples`, trocando nomes, clientes, imoveis, valores, documentos, telefones e e-mails por placeholders.

O aprendizado global melhora padroes de linguagem, mas nao compartilha dados reais de uma empresa com outra.

## Memoria curta

O chat envia `conversationContext` para `/api/assistant` com o ultimo membro citado, data de checklist e intent anterior. Assim, uma pergunta como "qual ele ja concluiu?" reaproveita o membro da pergunta anterior, por exemplo Joao Pedro, sem buscar fora da organizacao atual.

## Checklist de membro

Perguntas sobre funcionario, membro ou colaborador sao resolvidas por regras locais antes do Gemini. Para "o que Joao esta fazendo agora?", o assistente busca o checklist do dia, lista itens concluidos e infere o item atual pelo primeiro item aberto apos o ultimo concluido. Se houver activity log recente, ele tambem e exibido.

## Seguranca

- Dados consultados e gravados sempre respeitam `organization_id`.
- Dados globais de intents continuam globais, mas respostas usam somente dados da organizacao atual.
- Chaves de IA continuam server-side.
- Nenhuma `service_role key` e usada no frontend.
