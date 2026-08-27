# Sophia 4.0

## Arquitetura

A Sophia 4 adiciona um runtime em grafo sobre a base da Sophia 2/3. Conversas, tools reais, confirmacoes, memoria, documentos e auditoria anteriores continuam sendo usados.

O fluxo passa pelos nos:

1. entrada e normalizacao;
2. identidade e permissao;
3. classificacao local de intent/skill;
4. contexto de tela, operacao, memoria, documentos e modulos;
5. planejamento e roteamento para agente;
6. confirmacao de escrita;
7. execucao da tool real;
8. verificacao independente do resultado;
9. reflexao, aprendizado revisavel, resposta e eventos.

O resumo do grafo fica em `sophia_runs.output.sophiaV4`. Cada no tambem pode ser auditado em `sophia_graph_traces` depois da migration 059. Inputs completos, tokens e secrets nao entram no trace.

## Skills

A biblioteca V4 possui 13 skills: trabalho atual de membro, concluir etapa, alterar prazo, resumir cliente, buscar/responder/processar documento, criar tarefa/lembrete, consultar BuscaGEO/Analise Ambiental, briefing e revisao semanal.

Skills apontam apenas para tools registradas. Escritas exigem confirmacao e as operacoes de etapa, tarefa e prazo sao relidas no banco antes de a Sophia afirmar sucesso.

## Agentes internos

`SupervisorAgent` apenas roteia para Document, Finance, Service, Client, Tools ou Routine. Eles nao sao servicos separados e nao causam varias chamadas de modelo. O agente financeiro permanece restrito ao owner.

## Modelos

Selecao local e tools funcionam sem modelo externo. Quando configurado, Gemini usa a chave existente `GEMINI_API_KEY` e o modelo recomendado `gemini-2.5-flash-lite`. O provider `openai_compatible` fica opcional para Ollama/vLLM ou APIs compativeis futuras. Nenhum modelo ou GPU e instalado nesta fase.

O `.env.local` real nao e alterado automaticamente. As chaves necessarias ja existiam no projeto; apenas o exemplo foi atualizado para o modelo recomendado.

## UI

O botao da Sophia abre um painel lateral de altura total. O painel fecha por X, ESC ou overlay, move o foco para o input e mantem anexo, confirmacao e feedback. Em mobile ocupa toda a largura.

## Migration

Execute `supabase/migrations/059_sophia_4_adaptive_agent_core.sql` depois das migrations 054, 057 e 058.

## Limites

- O grafo V4 reutiliza os handlers reais existentes; novas operacoes dependem de novas tools verificaveis.
- Busca documental continua textual/FTS nesta entrega.
- O provider openai-compatible esta preparado, mas nao e obrigatorio.
- A avaliacao mede selecao, permissao e suporte; um ambiente de homologacao ainda e necessario para validar efeitos reais de escrita.
