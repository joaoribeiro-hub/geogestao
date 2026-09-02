# Memoria e aprendizado da Sophia

## Tipos

`memory_type` separa memoria `semantic`, `episodic`, `procedural`, `operational`, `reflection`, `preference` e `organization_rule`. A V4 acrescenta os escopos `user`, `organization` e `global_template`, preservando os escopos legados.

Memorias de usuario sao filtradas pelo `user_id`. Memorias de empresa ficam limitadas ao `organization_id` atual.

## Feedback

O dislike/correcao registrado pelo fluxo legado tambem cria uma linha em `sophia_reflections`. O endpoint novo e `POST /api/sophia/feedback`.

Depois de `SOPHIA_RULE_MIN_EVIDENCE` ocorrencias equivalentes, surge uma `sophia_rule_candidates`. Feedback e reflexoes continuam privados na organizacao. Quando o candidato tem escopo `global_candidate`, somente o platform developer acessa `/sophia/aprendizados` e aprova ou rejeita a versao sanitizada.

Nenhuma regra global e criada com nome, e-mail, telefone, CPF/CNPJ, CAR, valor, cliente, fazenda ou servico privado. `privacy-sanitizer.ts` mascara padroes e entidades contextuais antes de um template global.

## Memoria permanente

`persistSophiaMemory` exige `confirmed: true`. O runtime nao transforma uma resposta ou uma correcao isolada em regra permanente sem confirmacao.

Na V4, dislike com correcao cria reflexao estruturada, caso de regressao e, ao atingir `SOPHIA_RULE_MIN_EVIDENCE`, regra candidata. Regras locais continuam no escopo da organizacao. Uma candidata global aprovada e gravada em `platform_sophia_rules`, com auditoria em `sophia_rule_approvals`, e passa a ser recuperada como template procedural para usuarios autenticados.

## Privacidade global

Antes da fila global, o sanitizador remove ou mascara CPF/CNPJ, e-mail, telefone, CAR, matricula, valores e entidades nomeadas como cliente, fazenda, propriedade, imovel e servico. A tela tecnica nao lista as reflexoes privadas das empresas; ela mostra apenas `sanitized_rule` e contagem de evidencias.
