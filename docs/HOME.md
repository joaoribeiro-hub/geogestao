# Inicio

Fase: HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1.

O antigo Dashboard passa a se chamar Inicio. A tela inicial agora combina:

- saudacao com data atual e nome do usuario;
- busca global por clientes, servicos e menus;
- fallback orientado para o Assistente IA quando a busca nao encontra registro direto;
- tarefas do checklist diario do usuario;
- notificacoes recentes com abas visuais Tudo, Mencoes, Projetos e Notas;
- indicadores quantitativos/financeiros mantidos para o owner.

Regras:

- dados sempre filtrados por organization_id;
- admin operacional nao deve receber indicadores financeiros sensiveis quando a regra de permissao bloquear o menu/visao;
- escritas vindas do Assistente IA continuam exigindo confirmacao.

## HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1

O bloco de Notificacoes do Inicio agora usa dados reais do endpoint `/api/notifications`.

- Por padrao mostra apenas notificacoes nao lidas.
- O botao alterna entre "Mostrar todas" e "Mostrar apenas nao lidas".
- As abas Tudo, Mencoes, Projetos e Notas filtram imediatamente a lista carregada.
- O X de cada notificacao marca `read_at` e remove o item da lista de nao lidas sem navegar.
- Clicar no corpo da notificacao continua marcando como lida e abrindo `action_url`, quando existir.
- Se nao houver notificacoes nao lidas, o Inicio mostra estado vazio em vez de exibir historico antigo como novidade.
