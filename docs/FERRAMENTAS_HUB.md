# Ferramentas Hub

Fase: `FERRAMENTAS-HUB-1`.

## Objetivo

`/ferramentas` passa a ser o hub principal de ferramentas e módulos técnicos do GeoGestão. O topo esquerdo volta a funcionar como identidade do app e link para `/inicio`; a troca/abertura de ferramentas fica no menu lateral.

## Navegação

- Menu lateral: `Ferramentas` fica abaixo de `Inicio`.
- Logo/topo esquerdo: link para `/inicio`.
- Rotas antigas em `/modulos/...` continuam preservadas.

## Ferramentas cadastradas

Minhas ferramentas, todas liberadas neste ambiente de teste:

- MeuIMOVEL-CAR: `/modulos/meu-imovel-car`
- BuscaGEO: `/modulos/buscageo`
- Corretor RTK/PPP: `/modulos/corretor-rtk-ppp`
- Gerador RW5: `/modulos/gerador-rw5`
- Portal do Cliente: `/ferramentas/portal-cliente`
- Desenhar GEO: `/ferramentas/desenhar-geo`
- Análise Ambiental: `/ferramentas/analise-ambiental`

## Modelo técnico

Foram reaproveitadas:

- `app_modules`
- `organization_modules`
- `module_activity_logs`

A migration `048_ferramentas_hub.sql` adiciona metadados de marketplace em `app_modules`, como categoria, ícone, preço futuro, flags de worker/configuração e ordenação. Também adiciona campos de entitlement em `organization_modules`, mas mantém todas as ferramentas liberadas por padrão.

O ponto central em código fica em `src/lib/tools/tool-access.ts`:

- `getAvailableToolsForOrganization()`
- `getMyTools()`
- `getMoreTools()`
- `canUseTool()`
- `registerToolUsage()`

Nesta fase, `canUseTool()` libera toda ferramenta visível e habilitada. Futuramente, a função pode consultar entitlement/plano antes de liberar o botão `Abrir`.

## Marketplace futuro

`Mais ferramentas` já existe na interface para compra/solicitação futura. Neste ambiente de teste, a seção informa que todas as ferramentas estão liberadas.

Não há gateway de pagamento nesta fase.

## Como adicionar nova ferramenta

1. Adicionar definição em `src/lib/tools/tool-access.ts`.
2. Criar a rota ou apontar para rota existente.
3. Adicionar seed incremental em migration futura para `app_modules`.
4. Definir categoria, status, `pricing_mode`, worker/configuração e `sort_order`.
5. Atualizar documentação e testes.
