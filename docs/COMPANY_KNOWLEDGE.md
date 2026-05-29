# Base Interna Da Empresa

Fase: HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1.

Minha Empresa > Informacoes ganhou uma base interna por organizacao.

Categorias iniciais:

- Regras e diretrizes
- Cultura
- Acessos
- Reunioes
- Hierarquia

Estrutura preparada no banco:

- company_knowledge_categories
- company_knowledge_items
- company_knowledge_blocks

Regras:

- membros ativos da organizacao podem visualizar;
- somente owner pode editar;
- tudo e filtrado por organization_id;
- os blocos permitem registrar conteudos grandes como Autoridade, Responsabilidades e Rotina/Tarefas.

## HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1

A base interna deixou de ser apenas uma lista preparada.

- Cada categoria permite criar novos itens.
- Clicar em um item abre o detalhe via `Minha Empresa > Informacoes`.
- O detalhe permite editar titulo, status e descricao principal.
- Blocos personalizados podem ser adicionados, editados e apagados pelo owner.
- O item tambem possui checklist proprio com data e horario opcionais.
- Admin operacional visualiza, mas nao edita.

Nova tabela:

- `company_knowledge_checklist_items`

RLS:

- membros da organizacao leem;
- somente owner altera.

## UX-CLEAN-COMPANY-KNOWLEDGE-1

A Base Interna passa a funcionar como uma base de conhecimento por eixos.

Eixos padrao criados por organizacao:

- Regras e Diretrizes
- Cultura
- Acessos
- Reunioes
- Hierarquia
- Procedimentos Gerais

Paginas padrao:

- Politica de Vestimenta
- Codigo de Conduta
- LGPD
- Horario de Funcionamento
- Regras da Empresa
- Historia da Empresa
- Atividades e Eventos Corporativos
- Responsabilidade Social
- Senha de Acesso Porta Escritorio
- Senha do Wi-Fi
- reunioes semanais, mensais e anuais
- cargos de Hierarquia
- Como Utilizar o Notion
- Como Solicitar Material

Status permitidos:

- `em_revisao`
- `em_desenvolvimento`
- `atualizado`
- `nao_iniciada`

Cada eixo mostra a quantidade de paginas, ultima modificacao e status. O owner pode criar eixos e paginas por modal. Clicar em uma pagina abre `/minha-empresa/base-interna/[pageId]`, com conteudo em markdown simples, metadados, blocos personalizados e checklist da pagina.

A migration `036_ux_clean_company_knowledge.sql` tambem cria a funcao `seed_company_knowledge_defaults` e um trigger em `organizations`, para que novas organizacoes recebam os eixos/paginas padrao sem seed manual adicional.

Permissoes:

- owner cria e edita;
- admin operacional e membros visualizam;
- todas as consultas e escritas filtram `organization_id`.
