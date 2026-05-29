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

- Dashboard (somente owner)
- Servicos
- Propostas (subitem de Servicos)
- Contratos (subitem de Servicos)
- Clientes
- Agenda
- Financeiro (somente owner)

Configuracoes:

- Minha Empresa
- Minha Conta
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
5. Em atraso
6. Geo Protocolado no Cartorio
7. Geo Protocolado no INCRA
8. Geo - Pendencia de Confrontante
9. Geo Concluido
10. Servico perdido (oculto na experiencia principal desta fase; dados antigos nao sao apagados)

CAR:

1. Aguardando documentos
2. Proposta/Contrato
3. CAR em Andamento
4. Prioridade
5. Em atraso
6. CAR Protocolado/Em Analise
7. CAR Concluido
8. Servico perdido (oculto)

ITR/CCIR:

1. Aguardando documentos
2. Proposta/Contrato
3. ITR/CCIR em Andamento
4. Prioridade
5. Em atraso
6. Protocolado/Enviado
7. Concluido
8. Servico perdido (oculto)

Outros Servicos:

1. Aguardando documentos
2. Proposta/Contrato
3. Em Andamento
4. Prioridade
5. Em atraso
6. Concluido
7. Servico perdido (oculto)

Todo servico novo deve entrar primeiro em `Aguardando documentos`.

## Novo Servico

A tela `/servicos` possui o botao `Novo Servico`, abrindo um modal grande com:

- tipo de servico;
- nome do imovel/empreendimento;
- cliente opcional;
- descricao/observacoes;
- prioridade;
- data de criacao operacional;
- data prevista;
- status de pagamento;
- valor previsto;
- responsavel principal;
- municipio;
- condicao de pagamento;
- nome personalizado quando o tipo for `Outros`.

O valor previsto usa formato monetario brasileiro. Exemplos aceitos:

- `R$ 16.000,00`;
- `1.500,50`;
- `250,00`.

O valor `16.000` e interpretado como dezesseis mil reais, nao como dezesseis reais.

Ao criar o servico:

- o card e criado na primeira coluna do quadro do tipo escolhido;
- se existir a coluna `Aguardando documentos`, ela e usada;
- sao criados dois checklists vazios: `Checklist - Documentos` e `Checklist - Etapas`.
- o servidor recalcula a coluna inicial a partir do `service_type`, evitando depender apenas de um campo escondido do formulario.
- apos sucesso, o modal fecha, a tela atualiza e o usuario e levado para a aba do tipo de servico criado.
- o seletor de cliente usa busca reaproveitavel por nome, documento, telefone ou e-mail.

O filtro de periodo da tela de Servicos usa o intervalo operacional do servico:

- inicio: `service_date`, com fallback para `created_at`;
- fim: `completed_at` quando concluido, senao `due_date`, senao a data inicial.

Assim, um servico criado hoje com prazo para daqui dois meses aparece no filtro "Este mes" e continua aparecendo ate sair do intervalo operacional.

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

A coluna `Servico perdido` pode existir por compatibilidade em dados antigos, mas nao aparece no Kanban principal desta fase. Quando um servico antigo estiver nessa coluna:

- o valor sai do lucro estimado;
- o valor sai do lucro efetuado, mesmo se estava pago;
- o valor entra em lucro perdido;
- o historico registra o servico como perdido.

Se o servico sair de `Servico perdido`, ele volta a contar no lucro estimado e so volta ao lucro efetuado se o pagamento estiver marcado como efetuado.

A coluna `Em atraso` existe em todos os fluxos. Um servico e considerado atrasado quando `due_date` ja passou, a etapa nao e concluida e o servico nao esta em `Servico perdido`. A tela pode exibir dinamicamente esses cards em `Em atraso` mesmo quando o filtro de periodo selecionado nao incluiria o intervalo original.

Todo card de servico possui um botao vermelho `X` para exclusao. A exclusao pede confirmacao e remove:

- o servico;
- propostas vinculadas ao servico;
- contratos vinculados ao servico;
- receitas automaticas vinculadas ao servico.

A exclusao nao remove cliente, documentos do cliente, documentos globais, bases geograficas ou anexos do proprio servico nesta fase.

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
- municipio;
- tag Ativo/Inativo;
- botao Editar para owner ou responsavel principal;
- bloco Financeiro para owner ou responsavel principal;
- Informacoes adicionais do imovel;
- Checklist - Documentos;
- Checklist - Etapas;
- Movimentacoes.

Interacoes de servico com data/horario geram lembretes e notificacoes para os destinatarios padrao: criador e responsavel principal, quando existir.

Quando um servico nao possui cliente vinculado, o detalhe mostra:

- busca de cliente existente da mesma organizacao;
- ate 10 resultados visiveis;
- botao `Vincular`;
- botao `Cadastrar cliente`.

Owner e responsavel principal podem vincular ou cadastrar cliente no servico. Outros membros visualizam aviso sem acao.
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
## HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1

- O menu Servicos agora possui o bloco "Cronograma dos servicos" abaixo do Kanban.
- O cronograma usa o mes atual por padrao e permite navegar por mes anterior, atual e proximo.
- Servicos aparecem por data de inicio operacional e data prevista/final.
- Itens do Checklist - Etapas com data aparecem no cronograma e na Agenda.
- Itens do Checklist - Etapas com data e horario geram notificacoes de lembrete.
- Checklist - Documentos continua sem impacto na porcentagem do servico e nao alimenta cronograma.

## DOCUMENTS-STORAGE-ARCH-1

O detalhe do servico ganhou painel de documentos profissionais usando a tabela `documents` e o bucket privado `documentos`.

Paths de servico:

```text
organizations/{organization_id}/services/{service_id}/documents/{document_id}/{safe_filename}
```

Os anexos legados do servico continuam em `attachments` para compatibilidade e nao sao migrados automaticamente.
