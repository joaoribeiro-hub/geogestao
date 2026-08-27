# Avaliacoes da Sophia

A rota `/sophia/evals` e permitida para owner e admin tecnico. Os casos iniciais cobrem atividade da Natalia, conclusao de etapa, documento sem evidencia, resumo de cliente, permissao financeira, BuscaGEO, Analise Ambiental e alteracao de prazo.

`GET /api/sophia/evals` materializa os casos padrao de forma idempotente por `organization_id`. `POST /api/sophia/evals` executa um caso com as tools realmente disponiveis e grava o score em `sophia_eval_runs`.

Os scores atuais verificam:

- skill/tool selecionada;
- bloqueio de permissao;
- recusa de resposta documental sem suporte.

Para testar, abra a tela e use `Executar` em cada caso. Evals nao executam escritas: o grafo de avaliacao para no planejamento.
