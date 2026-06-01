# GeoGestao - Decisoes do Projeto

## AGENTS-TASKS-SYNC-FIX-1

- Google OAuth sem variaveis de ambiente deve orientar o admin na UI e nao expor JSON cru.
- Briefing da manha e Revisao semanal salvam resultado em `ai_agent_runs` como objeto JSON padronizado.
- Execucao automatica dos agentes usa endpoint cron protegido por `CRON_SECRET`; Vercel Cron fica em UTC.
- Tarefa e Rotina diaria usam vinculo entre `daily_checklist_items` e `routine_items` para manter a mesma fonte operacional.
- Tarefa aberta com data anterior continua aparecendo ate conclusao, cancelamento, arquivamento ou exclusao.
- Agente financeiro e seus resultados sao exclusivos de owner.

Data do checkpoint: 2026-05-11

## Decisoes registradas

1. O GeoGestao e um sistema para escritorio de agrimensura.

2. O produto pode usar sistemas como Undesk apenas como referencia de UX. Nao deve copiar marca, logo, nomes protegidos, identidade visual ou layout identico.

3. O fluxo integrado principal deve ser:

   ```text
   Proposta -> Contrato -> Servico -> Financeiro
   ```

4. O modulo de propostas deve continuar usando uma experiencia de Kanban comercial.

5. O modulo de servicos tecnicos deve manter Kanban com cards arrastaveis.

6. O sistema deve ter uma area chamada "Minha Empresa" para centralizar configuracoes e cadastros internos.

7. A area "Minha Empresa" deve futuramente incluir:

   - Informacoes da empresa;
   - Equipe;
   - Clientes;
   - Variaveis financeiras;
   - Documentos internos;
   - Bancos;
   - Servicos e nichos;
   - Opcoes de propostas;
   - Opcoes de contratos;
   - Armazenamento.

8. O sistema tem uma area de mapa com upload KML/KMZ.

9. O mapa deve vincular perimetros a cliente, imovel e servico.

10. Supabase Auth, Supabase Database e Supabase Storage permanecem como base tecnica do projeto.

11. Chaves secretas nao devem ser expostas no frontend.

12. `service_role key` nao deve ser usada no frontend.

13. `.env.local` nao deve ser commitado.

14. O projeto nao deve ser recriado do zero. Evolucoes devem respeitar a base existente.

15. Funcionalidades futuras nao devem aparecer como se estivessem prontas. Botoes ainda nao funcionais devem ficar ocultos ou claramente marcados como "em breve".

16. O README deve acompanhar mudancas importantes de instalacao, ambiente, migrations e fluxos operacionais.

17. O fluxo de conversao de proposta deve ser idempotente: clique duplo nao pode duplicar contrato, servico ou receita.

18. A Fase 1 prioriza contrato, conversao proposta -> servico e receita automatica. Minha Empresa, Propostas v2, documentos por imovel, dashboard avancado e mapa ficam para fases posteriores.

19. A implementacao inicial do mapa deve usar Leaflet.

20. A camada inicial do mapa deve usar OpenStreetMap.

21. O mapa nao deve depender inicialmente de Google Earth.

22. A arquitetura do mapa deve ficar preparada para uma camada de satelite futura via provedor com API adequada.

23. KML/KMZ devem permanecer vinculados a cliente, imovel e servico/card tecnico.

24. O arquivo KML/KMZ original deve ser mantido no Storage privado quando possivel, e o GeoJSON derivado pode ser salvo no banco para renderizacao.

25. A Fase UX-2 pode usar sistemas de referencia apenas como inspiracao conceitual de fluxo, sem copiar identidade, nomes protegidos, layout ou codigo.

26. A UI principal de Propostas deve conduzir a conversao por status comercial. "Aprovado" cria/reaproveita contrato e servico; "Em espera" move para negociacao; "Nao aprovado" move para perdidas.

27. Proposta aprovada com pagamento "Nao pago" deve criar/reaproveitar receita pendente. Pagamento "Pago" deve criar/reaproveitar a mesma receita como paga, sem duplicidade.

28. PDF real em Storage permanece desejavel, mas preview A4 com imprimir/salvar como PDF e vinculo posterior via attachments e aceitavel como passo intermediario quando a geracao real for complexa.

29. Migrations antigas nao devem ser editadas para UX-2. Novos campos/tabelas devem entrar em migration aditiva e segura.

30. A base multiempresa deve usar um unico Supabase com isolamento por `organization_id`. Nao deve ser criado um projeto Supabase por cliente.

31. A Fase ACCOUNT-1 prepara planos e limites, mas nao implementa cobranca real, Stripe ou Mercado Pago.

32. `OPENAI_API_KEY` deve ser usada apenas no servidor. Nunca criar ou expor `NEXT_PUBLIC_OPENAI_API_KEY`.

33. O Chat IA inicial e somente leitura/geracao de texto. Ele nao altera banco nem executa acoes no produto nesta fase.

34. O limite de armazenamento por plano deve ser aplicado primeiro nos uploads novos mais seguros de controlar, com migracao progressiva para uploads especializados.

35. A aba `/mapa` evolui para "Fazer busca de imovel", mas a rota deve ser mantida por compatibilidade.

36. Bases CAR, INCRA/SIGEF, alertas e tematicas devem ser consultadas a partir do Supabase/Postgres, depois de importadas. Google Drive e apenas origem bruta dos arquivos.

37. O app nao deve consultar shapefile, DBF ou ZIP grande diretamente do Drive em cada busca por CAR.

38. PostGIS e a solucao preferida para intersecoes, buffers e indices espaciais. Quando nao estiver disponivel, `geom_geojson` fica como fallback, com limitacoes documentadas.

39. O GeoGestao nao deve automatizar login gov.br, capturar senha, guardar cookies, burlar captcha ou fazer scraping agressivo de portais oficiais.

40. Documentos oficiais que exigem login pessoal devem seguir fluxo assistido: abrir link oficial, baixar manualmente e anexar no sistema.

41. SIGEF/INCRA nao deve ser cruzado por `cod_car`, porque a base SIGEF nao possui o CAR Federal como chave confiavel. O cruzamento deve ser espacial.

42. A regra padrao para considerar SIGEF correspondente e sobreposicao de pelo menos 60% da area do CAR buscado.

43. Alertas MapBiomas devem usar base importada e API oficial GraphQL MapBiomas Alerta. O GeoGestao nao deve fazer scraping da plataforma.

44. Credenciais MapBiomas Alerta devem ser usadas apenas no servidor, por `MAPBIOMAS_ALERT_TOKEN` ou `MAPBIOMAS_ALERT_EMAIL`/`MAPBIOMAS_ALERT_PASSWORD`.

45. A partir da FASE UX-ORG-SERVICES-1, Servico passa a ser o centro do sistema. Proposta e Contrato continuam existindo por compatibilidade, mas passam a ser subareas do Servico na experiencia principal.

46. O menu lateral deve priorizar uma experiencia simples: Dashboard, Servicos e Financeiro como eixo operacional, com cadastros e bibliotecas em Configuracoes.

47. Novo servico deve nascer em `Aguardando documentos`, com checklist padrao por tipo de servico. A fase `Proposta/Contrato` e o ponto de criacao ou visualizacao de proposta e contrato vinculados nos fluxos que possuem essa etapa. O fluxo CAR nao usa mais `Proposta/Contrato`; depois de `Aguardando documentos`, segue para `CAR em Retificacao`.

48. Reset de dados operacionais por empresa deve ser feito somente por script admin com dry-run por padrao e flag explicita `--confirm`. O reset nunca deve apagar usuarios, profiles, organizacoes, membros, planos, migrations ou bases geograficas globais.

49. A criacao de servico deve recalcular a coluna inicial no servidor a partir do `service_type`. O formulario pode sugerir a coluna, mas a regra de negocio nao deve depender apenas de campo escondido no client.

50. Apenas membros `owner` ou `admin` da organizacao podem editar Minha Empresa, cadastrar equipe operacional e configurar dados bancarios. Usuarios comuns podem visualizar quando fizer sentido.

51. A coluna `Servico perdido` existe em todos os fluxos de Servicos. Servicos nessa coluna deixam de contar em lucro estimado/efetuado e passam a contar em lucro perdido.

52. Valores de servico devem usar formato monetario brasileiro na interface. O valor `16.000` representa `R$ 16.000,00`.

53. Em `organization_members`, `owner` e `admin` tem responsabilidades diferentes: `owner` edita Minha Empresa e regras da empresa; `admin` e administrador operacional dos modulos, mas apenas visualiza Minha Empresa.

54. Dashboard, Documentos, Legislacao, Anexos, Clientes, Servicos e Financeiro devem filtrar dados operacionais pela organizacao atual. Dados sem `organization_id` nao devem aparecer como dados da empresa atual.

55. Documentos e legislacao podem ser da empresa ou globais/oficiais. Arquivos da empresa usam `organizations/{organization_id}/...`; arquivos globais usam `shared/...` e sao somente leitura para empresas.

56. O filtro de Servicos deve usar intervalo operacional, nao apenas prazo final. A data inicial e `service_date` com fallback para `created_at`, e a data final e `completed_at` quando concluido ou `due_date` quando ainda em andamento.

57. Servicos atrasados aparecem na coluna `Em atraso` em todos os fluxos quando o prazo passou, a etapa nao e concluida e o servico nao esta perdido. Servicos atrasados permanecem visiveis mesmo que o filtro de periodo nao os incluiria.

58. Cliente deve ter acoes explicitas de Visualizar, Editar e Apagar na Base de Clientes. A exclusao de cliente e bloqueada quando houver servicos vinculados ou documentos do cliente anexados.

59. Documentos do cliente devem registrar um nome documental legivel, com opcoes padrao rurais/imobiliarias e nome personalizado para `Outros`.

60. A exclusao de servico pelo card remove servico, propostas/contratos vinculados e receitas automaticas do servico, mas preserva cliente, documentos do cliente, documentos globais, bases geograficas e anexos do proprio servico nesta fase.

61. O Assistente IA deve executar apenas acoes registradas em action registry. Ele nao pode receber SQL livre, apagar dados ou afirmar que uma escrita foi feita sem a action server-side executar.

62. O Assistente IA deve funcionar sem API paga por interpretador local de intencoes. APIs externas como Gemini, OpenRouter ou Groq podem ser usadas futuramente apenas para classificar intencao e extrair parametros, nunca para consultar dados fora das actions internas.

63. Toda escrita feita pelo Assistente IA deve ser registrada em `assistant_action_logs` e respeitar `organization_id`.

64. Cadastro publico cria usuario sem empresa. O app fica limitado ate o usuario participar de uma organizacao por ID/codigo da empresa ou criar uma nova organizacao. O codigo de entrada e sensivel, visivel apenas para `owner`, e entrada por codigo cria `admin` operacional limitado pelo plano atual.

65. O Assistente IA deixa de ser menu principal e passa a ser acesso flutuante global. Escritas feitas pelo assistente exigem confirmacao visual e feedback supervisionado.

66. Checklist diario e activity log pertencem a organizacao atual. Membros podem consultar atividades internas da propria empresa, e owner pode atribuir itens de checklist para membros.

67. Correcoes feitas pelo botao "Nao" geram feedback bruto por organizacao e exemplos sanitizados globais para melhorar o Assistente IA sem vazar dados privados.

68. O Assistente IA usa memoria curta de conversa para resolver pronomes como "ele" e "esse membro" dentro da mesma sessao, sempre limitado a `organization_id`.

69. Comunicacao rapida da empresa passa a ter Chat da equipe flutuante, separado do Assistente IA e do Checklist diario. Mensagens, leituras e badges sao sempre filtrados por `organization_id`.

70. Servico agora possui `Checklist - Documentos` e `Checklist - Etapas`; novos servicos nascem sem itens padrao.

71. A porcentagem do servico depende apenas dos itens concluidos em `Checklist - Etapas`.

72. Financeiro por servico e visivel apenas ao owner e ao responsavel principal do servico.

73. Cliente ativo depende de possuir ao menos um servico ativo vinculado; cliente sem servico ativo aparece como inativo.

74. Dashboard e Financeiro ficam restritos ao owner no menu principal. Propostas e Contratos passam a subitens de Servicos.

75. Notificacoes centralizam prazos, lembretes e conclusoes de checklist; Agenda centraliza lembretes e prazos de servicos.

76. Agenda passa a ser calendario mensal visual; eventos aparecem nos dias correspondentes e a navegacao de mes pode ser refletida na URL por `month=YYYY-MM`.

77. Servico sem cliente pode vincular cliente existente no detalhe usando busca por cliente da organizacao. A busca e reaproveitada conceitualmente entre criacao e detalhe do servico.

78. Lembretes de cliente, servico e Agenda usam helper central de notificacoes, com `reminder_due_today`, janelas de 2h/1h/horario e `dedupe_key` idempotente por organizacao/destinatario/entidade/tipo.

79. Notificacoes podem ter `action_url` interno para abrir a origem; fechar uma notificacao marca como lida, nao apaga o registro.

80. Chat da equipe passa a ter conversa geral e conversa direta. Conversas diretas sao privadas entre os dois participantes e leituras sao controladas por `conversation_key`.
## HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1

- Dashboard passa a se chamar Inicio.
- Inicio vira busca global, tarefas do dia, notificacoes e indicadores reduzidos.
- Rotina sincroniza com Checklist de Hoje para itens diarios.
- Agenda suporta categorias, recorrencia semanal, edicao e cancelamento de lembretes.
- Servicos possuem cronograma mensal proprio alimentado por inicio, prazo e etapas.
- Financeiro passa a trabalhar visualmente com Entrada, Saida e Transferencia.
- Minha Empresa ganha base interna de conhecimento.
- Equipe migra visualmente para Minha Empresa > RH > Colaboradores.

81. Inicio mostra por padrao apenas notificacoes nao lidas. As abas Tudo, Mencoes, Projetos e Notas filtram de verdade sobre notificacoes do usuario atual.

82. Relatorios passam a centralizar tarefas/checklists da organizacao, iniciando por checklist diario e Rotina.

83. Base Interna da empresa passa a ter itens clicaveis, blocos personalizados e checklist proprio, com edicao restrita ao owner.

84. RH passa a ter aniversarios, ferias/faltas e documentos reais com calendario/upload, sempre por `organization_id`.

85. Controle de expediente e operacional interno, nao ponto eletronico legal. A contagem depende de heartbeat com pagina aberta/visivel e fica persistida por `organization_id` e `user_id`.

86. A confirmacao de seguranca ocorre a cada 2 horas de trabalho ativo, com 15 minutos de tolerancia. Intervalo e campo pausam esse ciclo.

87. Relatorios de horas usam jornada configurada no RH, feriados configuraveis e calculo diario antes de somar semana/mes.

88. Documentos profissionais passam a usar Supabase Storage privado no bucket `documentos`, com metadados em `documents`, chunks em `document_chunks`, quota por `organization_id` e download por signed URL. `attachments`, `document_templates`, `hr_documents` e `property_documents` permanecem como compatibilidade legada.

89. O upload profissional reserva quota antes de enviar, confirma uso apenas depois do upload e nunca aceita path arbitrario do frontend.

90. Bases internas da empresa sao organizadas por eixos e paginas por `organization_id`. Eixos/paginas padrao usam seed idempotente, owner edita e admins/membros visualizam.

91. Formularios grandes de criacao pontual devem abrir por botao + modal. Minha Empresa > Informacoes e excecao: permanece na pagina em modo visualizacao com botao Editar.

92. A navegacao padrao autenticada abre em `/inicio`; deep links especificos continuam respeitados.
## INTEGRATIONS-AGENTS-TASKS-IMPORT-1

- Google Drive é armazenamento opcional por usuário e não substitui o Supabase Storage como padrão.
- Tokens OAuth são armazenados criptografados e nunca enviados ao frontend.
- Google Calendar sincroniza eventos por destinatário quando o usuário conectou a própria conta.
- Sophia é o nome de interface do Assistente IA; as intents e a action registry permanecem iguais.
- Agentes executam server-side, salvam `ai_agent_runs` e não executam ações diretas sem validação backend.
- Importação Trello usa dry-run antes da confirmação e pula duplicados por `Card ID`.
