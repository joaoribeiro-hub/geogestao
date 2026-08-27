# Memoria e aprendizado da Sophia

## Tipos

`memory_type` separa memoria `semantic`, `episodic`, `procedural`, `operational`, `reflection`, `preference` e `organization_rule`. A V4 acrescenta os escopos `user`, `organization` e `global_template`, preservando os escopos legados.

Memorias de usuario sao filtradas pelo `user_id`. Memorias de empresa ficam limitadas ao `organization_id` atual.

## Feedback

O dislike/correcao registrado pelo fluxo legado tambem cria uma linha em `sophia_reflections`. O endpoint novo e `POST /api/sophia/feedback`.

Depois de `SOPHIA_RULE_MIN_EVIDENCE` ocorrencias equivalentes, surge uma `sophia_rule_candidates`. A regra nao vira memoria automaticamente: o owner acessa `/sophia/aprendizados` e aprova ou rejeita.

Nenhuma regra global e criada com nome, e-mail, telefone, CPF/CNPJ, CAR, valor, cliente, fazenda ou servico privado. `privacy-sanitizer.ts` mascara padroes e entidades contextuais antes de um template global.

## Memoria permanente

`persistSophiaMemory` exige `confirmed: true`. O runtime nao transforma uma resposta ou uma correcao isolada em regra permanente sem confirmacao.

Na V4, dislike com correcao cria reflexao estruturada, caso de regressao e, ao atingir `SOPHIA_RULE_MIN_EVIDENCE`, regra candidata. Somente o owner promove uma candidata para `organization_rule`; a aprovacao fica em `sophia_rule_approvals`.
