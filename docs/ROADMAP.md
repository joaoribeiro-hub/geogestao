# GeoGestao - Roadmap

Data do checkpoint: 2026-05-11

## Qualidade tecnica

### Fase QA-1: Infraestrutura de Testes Automatizados

Objetivo: criar uma base profissional de testes automatizados para proteger o GeoGestao contra regressoes nos fluxos criticos.

Escopo:

- Configurar Vitest para unidade e regras puras.
- Criar `tests/unit`, `tests/integration`, `tests/helpers` e `src/test`.
- Criar camada minima de services puros em `src/lib/services`.
- Testar schemas Zod, utilitarios e regras do fluxo proposta -> contrato -> servico -> financeiro.
- Configurar Playwright e `tests/e2e`.
- Criar E2E inicial da pagina de login.
- Preparar E2E autenticado de dashboard/mapa.
- Preparar E2E com escrita no banco para cliente, proposta, conversao, contrato, servico, pagamento e financeiro.
- Criar `docs/TESTING.md`.
- Criar workflow `.github/workflows/ci.yml`.

Status: parcial. Infraestrutura, scripts, testes iniciais, E2E basico e CI foram criados. Pendente rodar E2E autenticado/destrutivo em Supabase separado de teste e configurar secrets no GitHub.

## Refinamento UX e fluxo comercial

### Fase UX-2: Propostas, Contratos, PDF, Status Comercial e Filtros por Periodo

Objetivo: refinar o fluxo comercial sem copiar marca, layout ou codigo de sistemas de referencia, usando apenas ideias conceituais de UX.

Escopo:

- Criar filtro reutilizavel por periodo.
- Aplicar filtro em Dashboard, Propostas, Contratos, Servicos/Projetos e Financeiro.
- Trocar a acao principal de "Converter em servico" por status comercial:
  - Aprovado;
  - Em espera;
  - Nao aprovado.
- Fazer "Aprovado" criar/reaproveitar contrato e service card.
- Fazer "Nao aprovado" entrar como valor perdido/nao recebido.
- Adicionar controle Pago/Nao pago em propostas em execucao.
- Criar/reaproveitar receita paga ou receita pendente conforme pagamento.
- Manter Kanban de propostas e adicionar acoes de visualizar, editar, excluir e baixar PDF quando houver.
- Criar rota propria de proposta com preview A4 e impressao/salvar como PDF.
- Expandir wizard de proposta por modelo.
- Criar rota propria de contrato com detalhe, atalhos, preview A4 e wizard de contrato.
- Criar migration segura `007_ux2_proposals_contracts_documents.sql`.
- Atualizar testes unitarios/integracao e E2E destrutivo.

Status: parcial/implementado no codigo. Pendente aplicar a migration 007 no Supabase de teste e validar manualmente. Geracao real de PDF em Storage esta preparada por schema e attachments; a interface atual entrega preview A4 e impressao/salvar como PDF.

## Conta, multiempresa, planos e IA

### Fase ACCOUNT-1: Minha Conta, base multiempresa, menu e Chat IA inicial

Objetivo: preparar o GeoGestao para uso real por empresas e usuarios dentro de um unico Supabase, com isolamento progressivo por `organization_id`, estrutura de planos/limites e assistente IA server-side.

Escopo:

- Criar rota `/minha-conta`.
- Permitir edicao de dados pessoais, avatar e preferencias.
- Adicionar `profiles.organization_id` e campos de perfil.
- Criar `organizations`, `organization_members` e `plans`.
- Criar planos iniciais Gratuito e Premium basico.
- Preparar quota de armazenamento por organizacao/plano.
- Aplicar verificacao de limite inicialmente em avatar e anexos genericos.
- Vincular Minha Empresa a `organizations`.
- Reorganizar menu lateral em MENU e CONFIGURACOES.
- Criar Chat IA flutuante com chamada server-side em `/api/ai/chat`.
- Usar `OPENAI_API_KEY` apenas no servidor.
- Buscar contexto IA somente da organizacao do usuario logado.
- Atualizar testes unitarios/E2E e documentacao.

Status: parcial/implementado no codigo. Pendente aplicar `supabase/migrations/008_account1_organizations_profiles_ai.sql` no Supabase de teste, validar manualmente conta, organizacao, uploads e Chat IA, e depois avaliar aplicacao no Supabase oficial.

### Fase AUTH-ORG-PLANS-1: Cadastro publico, onboarding e planos

Objetivo: permitir cadastro publico com confirmacao de e-mail, recuperacao de senha, onboarding de empresa e base inicial de planos, sem pagamento real.

Escopo implementado:

- Tela de login com `Criar cadastro` e `Esqueci minha senha`.
- Cadastro publico por Supabase Auth.
- Trigger de Auth criando profile sem organizacao.
- Bloqueio de app operacional para usuario sem empresa.
- Onboarding para participar por ID da empresa ou criar nova empresa.
- Codigo de entrada por organizacao visivel apenas para owner.
- Entrada por codigo como `admin` operacional.
- Plano Iniciante com limite de 3 usuarios ativos.
- Base `organization_subscriptions` e `billing_orders` para cobranca futura.
- Minha Conta com visualizacao de plano.
- Reset de senha com mensagem generica e fluxo nativo Supabase.
- Documentacao `docs/AUTH_ONBOARDING.md` e `docs/PLANS_BILLING.md`.
- Correcao `024_onboarding_company_creation_debug_fix.sql` para constraint multiempresa de `company_settings` e diagnostico detalhado de falha.

Status: implementado no codigo. Pendente aplicar `supabase/migrations/023_auth_org_plans_onboarding.sql` e `024_onboarding_company_creation_debug_fix.sql` no Supabase de teste e validar cadastro, e-mail, onboarding, limite de usuarios e reset.

### Fase ASSISTANT-1: Assistente IA / Chat Inteligente

Objetivo: criar um chat operacional dentro do GeoGestao que consulta dados reais e executa acoes internas permitidas, funcionando primeiro por regras locais e ficando preparado para classificador externo opcional.

Escopo implementado:

- Rota `/assistente-ia`.
- API route `/api/assistant`.
- Action registry segura em `src/lib/assistant/actions.ts`.
- Detector local de intencoes.
- Provider opcional para Gemini, OpenRouter ou Groq apenas para classificacao de intencao.
- Historico, mensagens, intents, logs de acao e tarefas do assistente em migration nova.
- Intencoes iniciais para servicos, tarefas, clientes, propostas/contratos e interacoes.

Status: implementado no codigo. Pendente aplicar `supabase/migrations/021_assistant_module.sql` no Supabase de teste e validar manualmente.

### Fase AI-ASSISTANT-INTENTS-1: Base privada de exemplos/intents

Objetivo: importar uma base privada de frases reais para melhorar a deteccao de intencoes do Assistente IA, sem treinar modelo externo e sem expor dados reais no frontend.

Escopo implementado:

- Migration `022_assistant_intent_examples_dataset.sql`.
- Tabelas `assistant_intent_examples` e `assistant_dataset_imports`.
- Parser tolerante para TSV/CSV, JSONL, `frase -> intent`, chave/valor e linhas sem intent.
- Script admin `npm run assistant:import-intents`, com dry-run por padrao e importacao real apenas com `--confirm`.
- Deduplicacao por intent, texto normalizado e source.
- Helper server-side para buscar poucos exemplos similares.
- Gemini recebe somente exemplos relevantes quando o interpretador local nao tem confianca alta.
- Documentacao em `docs/ASSISTANT_INTENTS.md`.

Status: implementado no codigo. Pendente aplicar a migration 022 no Supabase de teste, rodar dry-run com o arquivo privado e importar com `--confirm` depois de conferir as contagens.

### Fase AI-ASSISTANT-ACTIONS-CHECKLIST-1: Actions, feedback e checklist

Objetivo: corrigir intencoes de escrita do assistente, exigir confirmacao antes de gravar, trocar o acesso para chat flutuante global e criar checklist diario por usuario.

Escopo implementado:

- Detector local prioriza verbos de criacao para `create_service`.
- Action registry cria servicos, itens de checklist e atribuicoes por owner.
- Feedback positivo/negativo salvo em `assistant_feedback`.
- Chat flutuante oficial usa `/api/assistant`.
- Menu lateral nao mostra mais Assistente IA.
- Checklist diario flutuante com data, emergencia e activity log.

Status: implementado no codigo. Pendente aplicar `supabase/migrations/027_assistant_checklist_feedback.sql` no Supabase de teste e validar manualmente.

## Servicos como centro do sistema

### Fase UX-ORG-SERVICES-1: Servicos, multiempresa e simplificacao visual

Objetivo: transformar Servicos no centro operacional do GeoGestao, mantendo o produto completo, mas com experiencia visual simples como um quadro de tarefas.

Escopo implementado:

- Remover Propostas e Contratos do foco do menu principal.
- Manter rotas antigas `/propostas` e `/contratos` por compatibilidade.
- Manter Clientes em Configuracoes/Base de Clientes.
- Criar botao `Novo Servico` em modal grande.
- Criar servico em `Aguardando documentos`.
- Criar checklist padrao conforme tipo de servico.
- Atualizar o Kanban de Servicos para cards mais limpos e clicaveis.
- Manter drag and drop e scroll horizontal.
- Adicionar acoes por etapa:
  - anexar documentacao;
  - concluir documentacao;
  - criar proposta;
  - criar contrato;
  - mover para execucao;
  - proximo.
- Reestruturar detalhe do servico com cliente em destaque, imovel abaixo, tipo como badge, chips editaveis, resumo automatico, anexos, membros e historico.
- Transformar Nova Receita/Nova Despesa em botoes com modal.
- Unificar a Base de Clientes por `organization_id`.
- Preparar storage por empresa com path `organizations/{organization_id}/...`.
- Criar migration `015_ux_org_services_center.sql`.
- Criar migration corretiva `016_services_workflow_company_team_permissions.sql` para colunas por tipo de servico, equipe, dados bancarios e permissoes owner/admin.
- Criar migration corretiva `017_org_members_rls_service_lost_finance.sql` para remover recursao de RLS, adicionar `Servico perdido` e calcular lucro estimado/efetuado/perdido por servico.
- Criar migration corretiva `019_documents_attachments_org_storage.sql` para isolar Dashboard/arquivos por empresa, separar documentos globais e documentos da empresa, e reforcar policies de Storage.
- Criar migration corretiva `020_services_operational_date_overdue_delete.sql` para data operacional de servico, coluna `Em atraso` e apoio a exclusao segura de servicos.
- Criar scripts admin:
  - `npm run admin:ensure-terras`;
  - `npm run admin:reset-org`.
- Criar documentacao `docs/SERVICES_FLOW.md` e `docs/ADMIN_ORGANIZATIONS.md`.

Status: parcial/implementado no codigo. Pendente aplicar `supabase/migrations/015_ux_org_services_center.sql`, `016_services_workflow_company_team_permissions.sql`, `017_org_members_rls_service_lost_finance.sql`, `018_company_owner_only_permissions.sql`, `019_documents_attachments_org_storage.sql` e `020_services_operational_date_overdue_delete.sql` no Supabase de teste, vincular owner da Terras Reunidas e validar manualmente o fluxo completo com dados reais.

## GeoQuery e bases geograficas

### Fase GEOQUERY-1: Fazer busca de imovel por CAR Federal com bases CAR, INCRA e Alertas

Objetivo: evoluir a antiga aba Mapa para uma ferramenta de consulta por CAR Federal, usando bases espaciais previamente importadas no Supabase/Postgres.

Escopo:

- Renomear o menu para "Fazer busca de imovel", mantendo a rota `/mapa`.
- Criar painel de busca por numero do CAR Federal.
- Preservar Leaflet/OpenStreetMap e o upload KML/KMZ legado.
- Criar estrutura de banco para fontes, CAR, INCRA/SIGEF, alertas, tematicas, historico, resultados e documentos.
- Tentar habilitar PostGIS e manter fallback por GeoJSON.
- Criar endpoint interno `POST /api/geoquery/search`.
- Mostrar mensagem clara quando a base CAR ainda nao foi importada.
- Preparar scripts de importacao por GeoJSON e documentar Drive como origem bruta.
- Incluir links oficiais para consulta publica CAR, Central CAR/gov.br, Meu Imovel Rural e ONR.
- Nao automatizar gov.br, captcha ou scraping.
- Atualizar testes unitarios e E2E da tela.
- Criar `docs/GEOQUERY.md`.

Status: parcial/implementado no codigo. Pendente aplicar `supabase/migrations/009_geoquery_car_incra_alerts.sql` no Supabase de teste, importar uma base pequena, validar busca real com geometria e evoluir intersecoes/buffer com PostGIS.

### Fase GEOQUERY-2A: Importador geografico robusto para arquivos grandes

Objetivo: evitar quebra por memoria ao lidar com GeoJSON grande e permitir carga administrativa em lotes no Supabase de teste.

Escopo:

- Trocar preview GeoJSON para leitura por streaming.
- Adicionar `--limit` e `--sample`.
- Mostrar mensagem clara quando o arquivo for grande demais para preview simples.
- Criar importador real `scripts/geo/import-geojson-to-supabase.ts`.
- Usar `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente em script local/admin.
- Gravar em lotes nas tabelas CAR, INCRA, alertas ou tematicas.
- Registrar `geo_data_sources`.
- Proteger arquivos brutos no `.gitignore`.
- Documentar fluxo de QGIS/sample, preview e importacao.

Status: parcial/implementado no codigo. Pendente validar com uma base grande real no Supabase de teste e, se necessario, adicionar preenchimento automatico de `geom` via PostGIS/RPC.

### Fase GEOQUERY-3: Cruzamento espacial CAR x SIGEF e MapBiomas Alerta

Objetivo: corrigir a correspondencia INCRA/SIGEF para usar geometria em vez de `cod_car`, e integrar a consulta server-side com a API oficial MapBiomas Alerta.

Escopo:

- Criar migration `010_geoquery_spatial_matching_mapbiomas.sql`.
- Preencher `geom` a partir de `geom_geojson`.
- Criar RPC `find_sigef_matches_by_car`.
- Usar regra padrao de 60% de sobreposicao da area CAR.
- Permitir ajuste de sobreposicao minima e buffer SIGEF na UI.
- Mostrar percentual de sobreposicao e areas CAR/SIGEF/intersecao.
- Desenhar SIGEF no mapa quando houver correspondencia.
- Aceitar classificacao `CAR_ALERT_INTERSECTION`.
- Normalizar `cod_car`, `cod_imovel`, `alert_code` e areas em `geo_alert_layers`.
- Criar service server-side MapBiomas Alerta.
- Criar endpoint interno `/api/geoquery/mapbiomas-alert`.
- Criar endpoint interno `/api/geoquery/mapbiomas-alert/report` para PDF interno do laudo com dados oficiais da API.
- Exibir botao "Visualizar laudo" para alertas com codigo.
- Atualizar testes e documentacao.

Status: parcial/implementado no codigo. Pendente aplicar a migration 010 no Supabase de teste, rodar `refresh_geoquery_geometries(true)`, validar com bases CAR/SIGEF/MapBiomas reais e confirmar credenciais MapBiomas.

## Fase 1: Contratos + conversao proposta -> servico + receita automatica

Objetivo: consolidar o fluxo comercial-operacional-financeiro.

Escopo:

- Criar modulo basico de Contratos.
- Adicionar aba/rota "Contratos" no menu.
- Criar tabela `contracts` por migration segura.
- Criar tipos TypeScript necessarios.
- Corrigir fluxo de converter proposta em servico.
- Ao converter proposta:
  - atualizar status/coluna da proposta para execucao;
  - criar ou reaproveitar contrato;
  - criar ou reaproveitar service card;
  - registrar audit log;
  - evitar duplicidade em clique duplo;
  - mostrar feedback visual.
- Adicionar tipo de servico obrigatorio em propostas.
- Disparar a conversao tambem ao arrastar proposta para "Propostas em Execucao".
- Criar receita somente no botao "Pagamento efetuado".
- Permitir "Voltar" na proposta e "Voltar servico" no card tecnico.
- Atualizar README com o fluxo.

Status: parcial. O codigo passa nas validacoes locais, mas a validacao manual ainda depende de aplicar `supabase/migrations/004_phase1_payment_and_service_repair.sql` no Supabase real para reparar o fluxo completo de conversao, pagamento e retorno.

## Fase 2: Minha Empresa

Objetivo: criar uma area central para configuracoes e cadastros internos.

Escopo previsto:

- Criar rota/area "Minha Empresa".
- Estrutura inicial com secoes ou abas:
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
- Mover ou espelhar acesso a Clientes dentro de "Minha Empresa", sem destruir a rota atual `/clientes`.
- Implementar informacoes da empresa.
- Implementar cadastro basico de servicos e nichos.

Status: implementado no codigo. Pendente aplicar `supabase/migrations/005_company_area.sql` no Supabase real e validar manualmente.

## Fase 3: Propostas v2 com Nova Proposta, upload PDF e modelo

Objetivo: melhorar o modulo comercial sem criar funcionalidades falsas.

Escopo previsto:

- Cards de resumo financeiro de propostas.
- Grafico simples de status das propostas.
- Botao "Nova Proposta".
- Menu com opcoes:
  - anexar proposta em PDF existente;
  - criar proposta usando modelo do sistema.
- Preparar arquitetura para geracao futura de PDF.

Status: implementado no codigo. A tela de Propostas tem cards de resumo, grafico simples, botao "Nova Proposta", fluxo de anexar PDF existente e inicio do wizard por modelo salvando rascunho.

## Fase 4: Gerador de proposta por etapas e pre-visualizacao

Objetivo: criar um wizard para propostas por modelo.

Etapas previstas:

- Registro;
- Demanda;
- Prazos;
- Financeiro;
- Secoes;
- Modelo;
- Pre-visualizacao;
- Gerar PDF;
- Salvar.

Nesta fase futura, o editor deve ser funcional e integrado ao fluxo comercial.

## Fase 5: Documentos de cliente/imovel

Objetivo: organizar documentacao por cliente e por imovel.

Categorias iniciais:

- Identidade;
- Matricula do imovel;
- CCIR;
- CAR Federal;
- Certidao de casamento;
- CND;
- ITR;
- Escritura;
- Outros.

Escopo previsto:

- Ajustar ou ampliar modelagem de anexos.
- Permitir categoria documental.
- Preparar entidade de imovel, quando necessario.
- Relacionar documentos a cliente, imovel e servico.

## Fase 6: Dashboard avancado

Objetivo: evoluir o dashboard para uma visao gerencial.

Escopo previsto:

- Filtros por periodo.
- Cards de resumo.
- Graficos simples.
- Visao de propostas.
- Visao de projetos.
- Visao financeira.
- Preparacao para visao de equipe.
- Proximos vencimentos.
- Projetos atrasados.

## Fase 7: Mapa com upload KML/KMZ

Objetivo: criar uma visao geografica dos projetos.

Escopo previsto:

- Upload de KML/KMZ do perimetro do imovel.
- Vinculo do arquivo a cliente, imovel e servico.
- Visualizacao de todos os projetos em mapa.
- Clique em perimetro para mostrar dados de projeto, cliente e imovel.
- Campos futuros de imovel:
  - nome do imovel;
  - area;
  - matricula;
  - data da matricula;
  - CAR Estadual;
  - CAR Federal;
  - municipio;
  - UF;
  - observacoes.

Status: parcial. Implementado no codigo e validado com typecheck, lint e build; pendente aplicar `supabase/migrations/006_map_properties_geometries.sql` no Supabase real e validar manualmente com um KML/KMZ simples.

Melhorias futuras:

- Camada de satelite via provedor com API adequada.
- Edicao de imoveis ja cadastrados.
- Controle avancado de versoes de perimetros.
- Suporte visual a multiplas camadas por propriedade.
- Validacao geoespacial mais robusta para KML/KMZ complexos.
- Medicao/calculo automatico de area a partir da geometria.

## Fase Comunicacao: Chat da equipe e badges

Status: implementado no codigo com migration `029_team_comms_checklist_badges.sql`, pendente aplicar no Supabase de teste e validar com usuarios owner/admin.

Escopo:

- badges no Checklist diario para itens abertos e itens atribuidos pelo owner;
- Chat da equipe flutuante por organizacao;
- badges de mensagens nao lidas, separando mensagens do owner;
- Supabase Realtime com polling leve como fallback;
- activity log para mensagens enviadas.
