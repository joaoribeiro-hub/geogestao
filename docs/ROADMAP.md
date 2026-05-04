# GeoGestao - Roadmap

Data do checkpoint: 2026-04-30

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
  - criar ou reaproveitar receita pendente;
  - registrar audit log;
  - evitar duplicidade em clique duplo;
  - mostrar feedback visual.
- Atualizar README com o fluxo.

Status: implementado no codigo. Pendente validar no Supabase real depois de aplicar a migration correspondente, se ela ainda nao estiver aplicada.

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

Status: backlog tecnico. Nao implementar mapa completo antes das fases anteriores.
