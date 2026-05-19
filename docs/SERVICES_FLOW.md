# GeoGestao - Fluxo de Servicos

## Decisao de produto

A partir da FASE UX-ORG-SERVICES-1, o Servico passa a ser o centro operacional do GeoGestao.
Propostas e Contratos continuam existindo por compatibilidade, mas deixam de ser o foco do menu principal e passam a ser tratados como subareas vinculadas ao Servico.

Conceito:

```text
Completo como um sistema profissional. Simples como um quadro de tarefas.
```

## Menu

Menu principal:

- Dashboard
- Servicos
- Financeiro

Configuracoes:

- Minha Empresa
- Minha Conta
- Clientes / Base de clientes
- Documentos
- Legislacao
- Anexos

A rota `/mapa` permanece preservada conforme decisoes anteriores, mas a fase atual nao altera GeoQuery, MapBiomas, CAR, SIGEF ou gov.br.

## Colunas por tipo de servico

Georreferenciamento:

1. Aguardando documentos
2. Proposta/Contrato
3. Geo em Andamento
4. Prioridade
5. Geo Protocolado no Cartorio
6. Geo Protocolado no INCRA
7. Geo - Pendencia de Confrontante
8. Geo Concluido
9. Servico perdido

CAR:

1. Aguardando documentos
2. Proposta/Contrato
3. CAR em Andamento
4. Prioridade
5. CAR Protocolado/Em Analise
6. CAR Concluido
7. Servico perdido

ITR/CCIR:

1. Aguardando documentos
2. Proposta/Contrato
3. ITR/CCIR em Andamento
4. Prioridade
5. Protocolado/Enviado
6. Concluido
7. Servico perdido

Outros Servicos:

1. Aguardando documentos
2. Proposta/Contrato
3. Em Andamento
4. Prioridade
5. Concluido
6. Servico perdido

Todo servico novo deve entrar primeiro em `Aguardando documentos`.

## Novo Servico

A tela `/servicos` possui o botao `Novo Servico`, abrindo um modal grande com:

- tipo de servico;
- nome do imovel/empreendimento;
- cliente opcional;
- descricao/observacoes;
- prioridade;
- data prevista;
- status de pagamento;
- valor previsto;
- responsavel principal.

O valor previsto usa formato monetario brasileiro. Exemplos aceitos:

- `R$ 16.000,00`;
- `1.500,50`;
- `250,00`.

O valor `16.000` e interpretado como dezesseis mil reais, nao como dezesseis reais.

Ao criar o servico:

- o card e criado na primeira coluna do quadro do tipo escolhido;
- se existir a coluna `Aguardando documentos`, ela e usada;
- um checklist padrao e criado conforme o tipo de servico.
- o servidor recalcula a coluna inicial a partir do `service_type`, evitando depender apenas de um campo escondido do formulario.
- apos sucesso, o modal fecha, a tela atualiza e o usuario e levado para a aba do tipo de servico criado.

## Regras de movimentacao

Na coluna `Aguardando documentos`, o card mostra:

- Anexar documentacao;
- Cadastrar cliente, se nao houver cliente;
- Concluir documentacao.

Ao concluir documentacao, o card vai para `Proposta/Contrato`.

Na coluna `Proposta/Contrato`, o card mostra:

- Nova Proposta;
- Novo Contrato;
- Em execucao.

Ao clicar em `Em execucao`:

- prioridade alta vai para `Prioridade`;
- demais prioridades vao para `Geo em Andamento`.

Nas colunas de execucao, o botao `Proximo` move o card para a proxima coluna a direita dentro do fluxo daquele tipo.

A coluna `Servico perdido` existe em todos os fluxos. Quando um servico entra nessa coluna:

- o valor sai do lucro estimado;
- o valor sai do lucro efetuado, mesmo se estava pago;
- o valor entra em lucro perdido;
- o historico registra o servico como perdido.

Se o servico sair de `Servico perdido`, ele volta a contar no lucro estimado e so volta ao lucro efetuado se o pagamento estiver marcado como efetuado.

## Card limpo

O card mostra apenas o essencial:

- cliente em destaque;
- nome do imovel/empreendimento;
- barra de cor de status;
- indicadores discretos de checklist/anexos;
- prazo;
- prioridade e pagamento em texto compacto.

O card inteiro e clicavel e abre `/servicos/[id]`. O botao antigo `Abrir detalhes` foi removido.

## Detalhe do servico

A pagina `/servicos/[id]` mostra:

- cliente em destaque;
- nome do imovel/empreendimento;
- tipo de servico como badge pequeno;
- resumo automatico deterministico;
- chips editaveis de etapa, prioridade e pagamento;
- percentual concluido;
- valor previsto e responsavel principal quando informados;
- proposta e contrato vinculados;
- checklists;
- anexos;
- membros;
- historico de eventos/movimentacoes.

O JSON bruto de metadados nao e exibido para o usuario.

## Financeiro do servico

O financeiro considera valores de servicos da organizacao atual:

- `Lucro estimado`: soma dos valores de servicos ativos, exceto `Servico perdido`;
- `Lucro efetuado`: soma dos valores de servicos ativos com `Pagamento efetuado`;
- `Lucro perdido`: soma dos valores de servicos em `Servico perdido`;
- `Resultado do periodo`: lucro efetuado menos despesas do periodo.

Quando o servico tem cliente e valor, o app prepara uma receita automatica vinculada ao `service_card_id`. A sincronizacao e idempotente: mudar pagamento varias vezes atualiza a receita automatica existente em vez de duplicar.

## Checklists padrao

Georreferenciamento:

- Documentos pessoais
- Matricula
- CCIR
- ITR
- CAR
- Procuracao, se necessario
- ART
- Levantamento de campo
- Processamento
- Memorial descritivo
- Planta
- Envio/registro

CAR:

- Documentos do proprietario
- Matricula
- Area do imovel
- Consulta CAR
- Analise ambiental
- Retificacao/cadastro
- Recibo/demonstrativo
- Entrega

ITR/CCIR:

- Dados do imovel
- Dados do proprietario
- CCIR
- ITR anterior
- CAFIR/CIB, se aplicavel
- Declaracao
- Protocolo
- Entrega

Outros Servicos:

- Briefing
- Levantamento
- Estudo preliminar
- Anteprojeto
- Projeto executivo
- Aprovacao
- Entrega final

## Pendencias conhecidas

- O fluxo de proposta/contrato dentro do servico cria registros vinculados rapidamente. O reaproveitamento do wizard visual completo de Propostas/Contratos pode ser refinado em uma fase posterior.
- A area de membros depende da migration `015_ux_org_services_center.sql`.
- Historico estruturado em `service_events` depende da mesma migration.
- Regras financeiras existentes foram preservadas.
- A migration corretiva `016_services_workflow_company_team_permissions.sql` adiciona os fluxos iniciais para CAR, ITR/CCIR e Outros Servicos, equipe operacional, dados bancarios e permissao owner/admin para edicao de Minha Empresa.
