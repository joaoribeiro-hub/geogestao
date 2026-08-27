# GeoGestao - Decisoes do Projeto

## SOPHIA-3-COGNITIVE-CORE-DOCUMENT-INTELLIGENCE-1

- `document_chunks` existente e reaproveitado; a migration adiciona FTS em vez de criar uma tabela paralela de chunks.
- pgvector nao e obrigatorio: FTS e fallback textual continuam sendo a base funcional.
- Feedback negativo gera reflexao por organizacao/usuario; regra candidata exige evidencia e aprovacao do owner.
- Eventos de `organization_activity_log` entram em fila por trigger e sao processados por cron protegido.
- Planos multi-etapas ficam restritos a leituras; escrita, exclusao, financeiro e documento sensivel continuam exigindo confirmacao.
- Gemini permanece padrao. Provider OpenAI-compatible e apenas uma interface server-side para uso futuro/local.

## ANALISE-AMBIENTAL-ANA-HIDRO-1

- `Água` e `Hidrografia oficial` são camadas diferentes: `Água` vem da classificação raster MapBiomas; `Hidrografia oficial` vem da base vetorial ANA/SNIRH BHO 6.
- A BHO 6 não deve ser baixada a cada job. O worker usa cache local em `ANA_HIDRO_CACHE_DIR`.
- A fonte principal da hidrografia oficial é `GEOFT_BHO_TRECHO_DRENAGEM.gpkg`, versão 6.2.4.
- A UI só habilita `Hidrografia oficial` quando o worker informa que o provider ANA/BHO6 está configurado.
- O fallback ArcGIS fica apenas preparado por variável e não substitui o GPKG como fonte principal nesta fase.

## MODULE-HUB-EXTERNAL-APPS-1

- O topo esquerdo do app passa a ser seletor de modulos, nao apenas marca estatica.
- Apps antigos entram primeiro como rotas internas seguras com status de migracao.
- Nenhum app antigo sera copiado cegamente sem isolamento por `organization_id`.
- `user_preferences` passa a ser a tabela canonica de preferencias visuais por usuario.
- A fonte padrao real para novo usuario e `font_scale = 1.2`.
- `user_ui_preferences` permanece apenas como compatibilidade legada.

## MODULE-HUB-MIGRATION-2

- MeuIMOVEL-CAR deve reaproveitar as tabelas GeoQuery existentes em vez de duplicar CAR/SIGEF/INCRA.
- Corretor RTK/PPP e Gerador RW5 rodam como APIs internas Next.js, nao como servidores locais antigos.
- Jobs de modulos operacionais devem ter `organization_id` e usar Storage em `organizations/{organization_id}/modules/...`.
- Se o Storage/tabela ainda nao estiver aplicado, o modulo pode entregar download imediato, mas deve avisar que o historico depende da migration.

## MODULE-HUB-REAL-PORT-1

- A rota duplicada `app-2026-06-25` nao fica mais no seletor; o app real e `Gerador RW5`.
- Corretor RTK/PPP e Gerador RW5 devem portar a logica leve para TypeScript/Next sempre que isso evitar servidor local antigo.
- BuscaGEO nao deve rodar GDAL pesado em server action/Vercel; a tela cria jobs e o processamento fica para worker/API separada.
- `worker_pendente` e um status explicito do hub, diferente de `em_migracao`.
- A pasta `C:\Users\srlan\Documents\Codex\2026-05-29` so vira modulo quando existir e for auditada.

## BUSCAGEO-REAL-INTEGRATION-1

- BuscaGEO usa Supabase Storage privado no bucket `documentos` e paths em `organizations/{organization_id}/modules/buscageo/...`.
- A interface do GeoGestao controla o fluxo; o processamento pesado fica em worker FastAPI separado.
- O worker pode usar `SUPABASE_SERVICE_ROLE_KEY`, mas somente fora do frontend.
- O app Next aciona o worker com `BUSCAGEO_WORKER_SECRET` e recebe atualizacoes por callback protegido.
- O catalogo local passa a marcar BuscaGEO como `beta`; se o worker nao estiver configurado, o job entra em `worker_pending`.
- Arquivos `.bat`, servidor local antigo e storage local do app antigo nao sao executados dentro do GeoGestao.

## UI-SOPHIA-ROUTINE-TASKS-1

93. A ordenacao manual de tarefas usa `sort_order` e define o primeiro item aberto como trabalho provavel atual.

94. Widget Tarefa, Rotina diaria, Inicio, Relatorios e Sophia devem usar a mesma ordem operacional.

95. Preferencias visuais de escala de fonte e tema claro/escuro ficam em `localStorage` nesta fase, sem criar dependencia de banco.

96. Mencoes com `@` na Rotina so podem apontar para membros ativos da mesma `organization_id`.

97. Sophia pode adiar datas previstas de servicos apenas por action server-side com confirmacao e permissao; comandos em massa ficam restritos ao owner.

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

93. Ferramentas passam a ser abertas pelo menu lateral em `/ferramentas`. O topo esquerdo volta a ser identidade do GeoGestao e link para `/inicio`; rotas antigas em `/modulos/...` continuam preservadas.

94. Marketplace/cobrança por ferramenta fica preparado em `app_modules` e `organization_modules`, mas todas as ferramentas visiveis ficam liberadas no ambiente de teste.

95. Portal do Cliente, Desenhar GEO e Analise Ambiental entram como rotas iniciais beta. Motores pesados, portal publico real e worker ambiental ficam para fases especificas.

96. O MapBiomas User Toolkit anexado e referencia conceitual para GEE/assets/classes; nao foi copiado nem usado como dependencia funcional do GeoGestao.

97. Portal do Cliente usa link público com token aleatório e guarda apenas `token_hash`. A rota pública recebe um DTO via função `security definer`, sem liberar SELECT direto nas tabelas internas.

98. Desenhar GEO executa cálculo local em TypeScript e permite DXF local. KML continua bloqueado até existir georreferenciamento real com CRS informado.

99. Análise Ambiental cria jobs e salva KML/KMZ/ZIP em Storage privado, mas processamento raster/vetorial fica obrigatoriamente em worker Python separado.

100. Análise Ambiental passa a usar worker Python em `workers/analise-ambiental`; o Next.js não processa raster pesado e apenas cria jobs, aciona o worker e assina downloads.

101. Resultados ambientais de desenvolvimento precisam declarar `source = dev_fixture`; dados oficiais/GEE ficam desativados até configuração explícita futura.

102. Job ambiental só deve ser considerado completo quando as camadas ambientais solicitadas foram geradas ou quando a pendência de provider ficou explícita em `provider_pendente`.

103. Shapefile de Análise Ambiental sempre é entregue como `.shp.zip`, nunca como `.shp` isolado.
104. Análise Ambiental só pode tratar `dev_fixture` como resultado simulado. O status deve ser `simulado`, o relatório deve trazer `provider = dev_fixture` e `official_data = false`, com aviso visível na UI.

105. O provider real inicial da Análise Ambiental é `mapbiomas_real`, alimentado por GeoTIFF local/URL/uploadado. Ele recorta o raster pela AOI e vetoriza classes por pixels; sem raster configurado, o worker não inventa geometria ambiental.

106. A legenda MapBiomas usada pelo worker fica centralizada em `workers/analise-ambiental/app/mapbiomas_classes.py` para ajuste por coleção sem espalhar códigos no processamento.

107. O fluxo principal da Análise Ambiental deve usar `mapbiomas_gee`: o usuário envia apenas KML/KMZ/ZIP e o worker consulta Earth Engine. GeoTIFF manual é modo avançado/developer.

108. Credenciais GEE e service account ficam exclusivamente no worker. Nenhuma variável GEE deve usar `NEXT_PUBLIC` ou ser enviada ao frontend.

109. `MAPBIOMAS_10M_ASSET_ID` é obrigatório para `mapbiomas_gee` e não deve ser hardcoded no código, pois asset/coleção/ano podem mudar.
## INTEGRATIONS-AGENTS-TASKS-IMPORT-1

- Google Drive é armazenamento opcional por usuário e não substitui o Supabase Storage como padrão.
- Tokens OAuth são armazenados criptografados e nunca enviados ao frontend.
- Google Calendar sincroniza eventos por destinatário quando o usuário conectou a própria conta.
- Sophia é o nome de interface do Assistente IA; as intents e a action registry permanecem iguais.
- Agentes executam server-side, salvam `ai_agent_runs` e não executam ações diretas sem validação backend.
- Importação Trello usa dry-run antes da confirmação e pula duplicados por `Card ID`.
# Sophia 2.0

- Sophia 2.0 evolui a rota conversacional sem remover `/api/assistant`.
- Toda tool da Sophia precisa apontar para funcionalidade real do GeoGestao; funcionalidades futuras não entram como mock.
- Escritas passam por confirmação humana e por validação server-side.
- `access_state`/`billing_mode` controlam acesso comercial futuro de módulos sem substituir o status operacional do módulo.
# GERADOR-RW5-LOGICA-FINAL

- O modo do RW5 e decidido pela primeira base valida do proprio arquivo: `B_` e registrado; `base_` e vinculado.
- Arquivos sao processados isoladamente; nenhum ponto, base ou equipamento de outro arquivo completa a conversao atual.
- Perfis de equipamento sem SN/FW confirmado bloqueiam a geracao.
- Celulas XLSX vazias sao preservadas pela referencia de coluna para evitar deslocamento de dados.
## Fase UI-PERFIS-ACESSIBILIDADE-SERVICOS-1

- O perfil operacional é uma configuração da organização e fica em `organizations.operational_profile`.
- Tipos personalizados de serviço ficam vinculados à organização; os boards históricos globais de Agrimensura são preservados para compatibilidade.
- Desativação de tipo ou etapa é soft delete e nunca pode deixar cards órfãos.
- O command menu inicial usa Ctrl/Cmd+K e navega por rotas seguras, ficando preparado para busca contextual.
### Sophia Document Intelligence

- A Sophia processa documentos primeiro localmente e só usa Gemini opcionalmente para interpretação de trechos, sem enviar o arquivo inteiro por padrão.
- O worker documental é separado do Next.js e é o único componente autorizado a usar `SUPABASE_SERVICE_ROLE_KEY`.
- Busca textual e citações por página são o caminho inicial; embeddings, pgvector e PaddleOCR ficam desacoplados para fase posterior.

### Workers no Render Free

- Os workers Python são serviços Docker independentes; o Next.js continua sendo o único proxy chamado pelo navegador.
- O contrato mínimo de disponibilidade é `GET /health` sem autenticação, retornando `status: ok` e `service`; operações continuam protegidas pelo segredo server-side.
- A porta de produção é sempre a variável `$PORT` do Render, com fallback local específico de cada worker.
- Cold start é tratado no servidor com health check e espera limitada a 90 segundos; não há retry infinito nem exposição de segredos.
- O armazenamento persistente de resultados permanece no Supabase Storage; cache local do plano Free é descartável.

### Sophia 4.0

- A Sophia 4 e uma camada incremental sobre Sophia 2/3; `/api/assistant` permanece compativel.
- Regras locais, permissoes e tools reais precedem qualquer chamada de modelo.
- Gemini recomendado e `gemini-2.5-flash-lite`; ausencia de Gemini usa `local_stub` e nao derruba as operacoes locais.
- Supervisor apenas roteia. Agentes internos nao sao microservicos e nao executam varias chamadas caras por padrao.
- Escrita so e sucesso depois de confirmacao humana e verificacao; falha de verificacao nunca vira mensagem de sucesso.
- Aprendizado de empresa exige evidencia repetida e aprovacao do owner. Template global precisa ser sanitizado.
- A Sophia abre em painel lateral de altura total; a UI nao altera worker, OCR ou RAG.
