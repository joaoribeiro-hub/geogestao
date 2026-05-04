# GeoGestao - Estado Atual do Projeto

Data do checkpoint: 2026-04-30

## Visao geral

GeoGestao e um sistema web de gestao para escritorio de agrimensura com ate 10 usuarios. O objetivo do MVP e substituir parcialmente Trello e planilhas, centralizando CRM, propostas, servicos tecnicos, financeiro basico, anexos, documentos, legislacao e dashboard.

O projeto nao deve ser recriado do zero. A base atual ja esta funcional, com Supabase real conectado via `.env.local`, login funcionando e dados seedados para testes.

## Stack usada

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Componentes no padrao shadcn/ui
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- `@supabase/supabase-js`
- `@supabase/ssr`
- `dnd-kit` para Kanban drag and drop
- Zod para validacao
- React Hook Form para formularios
- ESLint e TypeScript para validacao

## Variaveis de ambiente

Variaveis publicas usadas pelo frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Observacoes:

- A variavel recomendada para projetos Supabase novos e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` permanece como fallback de compatibilidade.
- Nenhuma `service_role key` deve ser usada ou exposta no frontend.
- `.env.local` deve permanecer fora do Git.
- `.env.local` esta listado no `.gitignore`.

## Status da integracao Supabase

- Supabase real ja foi conectado via `.env.local`.
- Login com Supabase Auth ja funciona.
- O app ja abriu em `http://localhost:3000`.
- Dashboard, clientes, propostas e servicos ja foram visualizados com dados seedados.
- Storage esta previsto para anexos.
- Row Level Security foi considerada nas migrations iniciais.

## Comandos para rodar

Instalar dependencias:

```bash
npm install
```

Rodar localmente:

```bash
npm run dev
```

Em ambiente Windows/PowerShell, se `npm.ps1` for bloqueado pela politica de execucao, usar:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev -- --hostname 0.0.0.0 --port 3000
```

URL de preview esperada:

```text
http://localhost:3000
```

Validacoes usadas no projeto:

```bash
npm run typecheck
npm run lint
npm run build
```

No ultimo ciclo de implementacao da Fase 1, essas validacoes passaram.

## Rotas existentes

- `/login` - tela de login.
- `/` - dashboard.
- `/clientes` - lista e busca de clientes.
- `/clientes/[id]` - detalhe de cliente.
- `/propostas` - Kanban de propostas.
- `/servicos` - quadros e cards de servicos tecnicos.
- `/servicos/[id]` - detalhe de card/servico tecnico.
- `/financeiro` - receitas, despesas e resumos basicos.
- `/documentos` - biblioteca de modelos/documentos.
- `/legislacao` - biblioteca de legislacao/normas.
- `/anexos` - listagem/envio de anexos.
- `/contratos` - modulo basico de contratos.

## Modulos ja implementados

### Autenticacao e layout

- Login com Supabase Auth.
- Middleware para protecao de rotas autenticadas.
- Layout base autenticado com menu lateral.
- Perfil de usuario previsto via tabela `profiles`.

### CRM

- CRUD/listagem de clientes PF/PJ.
- Busca de clientes.
- Detalhe de cliente.
- Historico de interacoes com cliente.

### Propostas

- Kanban com colunas comerciais.
- Cards com cliente, titulo, descricao, valor e responsavel.
- Drag and drop com persistencia.
- Fluxo de conversao de proposta em servico foi ajustado na Fase 1.

### Servicos tecnicos

- Estrutura flexivel de quadros, colunas e cards.
- Quadros seedados para Geo, CAR, ITR/CCIR e Outros Servicos.
- Kanban tecnico com cards arrastaveis.
- Historico simples de movimentacao previsto.
- Checklists por card.

### Financeiro

- Receitas.
- Despesas.
- Status pendente, pago e vencido.
- Resumos basicos.
- Receita pendente automatica no fluxo de conversao de proposta.

### Anexos

- Tabela generica `attachments`.
- Vinculo por `entity_type` e `entity_id`.
- Suporte a anexos para clientes, propostas, servicos, receitas, despesas, documentos, legislacao e contratos.

### Documentos

- Biblioteca de modelos/documentos.
- Campos de titulo, categoria, versao, status, descricao e arquivo/anexo.

### Legislacao

- Biblioteca de normas/legislacao.
- Busca e campos de apoio tecnico.

### Contratos

- Modulo basico criado na Fase 1.
- Rota `/contratos`.
- Contrato vinculado a cliente, proposta e opcionalmente servico.
- Status iniciais de contrato modelados.
- Criacao/reaproveitamento automatico no fluxo de conversao.

## Migrations existentes

### `supabase/migrations/001_initial_schema.sql`

Cria a base inicial:

- `profiles`
- `clients`
- `client_interactions`
- `proposals`
- `service_boards`
- `service_columns`
- `service_cards`
- `service_card_movements`
- `checklists`
- `checklist_items`
- `attachments`
- `revenues`
- `expenses`
- `document_templates`
- `legislation_items`
- `audit_logs`
- RLS basica
- Politicas para usuarios autenticados
- Bucket/politicas de storage para anexos

### `supabase/migrations/002_contracts_conversion_flow.sql`

Adiciona a Fase 1:

- tabela `contracts`
- vinculos `proposal_id` e `contract_id` em `service_cards`
- vinculo `contract_id` em `revenues`
- indices para idempotencia do fluxo de conversao
- RLS para contratos
- suporte a `contract` em `attachments.entity_type`

## Tipos principais

O arquivo `src/types/database.ts` concentra os tipos TypeScript principais, incluindo:

- `Profile`
- `Client`
- `ClientInteraction`
- `Proposal`
- `ServiceBoard`
- `ServiceColumn`
- `ServiceCard`
- `Checklist`
- `ChecklistItem`
- `Attachment`
- `Revenue`
- `Expense`
- `DocumentTemplate`
- `LegislationItem`
- `AuditLog`
- `Contract`
- `ContractStatus`

## Funcionalidades ja testadas pelo usuario

- App abriu em `localhost`.
- Supabase conectado via `.env.local`.
- Login funcionando.
- Dashboard visivel.
- Clientes visiveis.
- Propostas visiveis.
- Servicos visiveis.
- Dados seedados disponiveis.

## Problemas conhecidos

- O comando `git` nao esta disponivel no PATH deste ambiente no momento do checkpoint; por isso o commit/push automatico nao pode ser executado ate o Git ficar disponivel.
- A migration `002_contracts_conversion_flow.sql` precisa estar aplicada no Supabase real antes de validar o fluxo completo de contratos/conversao/receita em producao local conectada ao banco real.
- Em PowerShell, `npm.ps1` pode ser bloqueado por politica de execucao; `npm.cmd` funciona como alternativa.
- Botoes e telas futuras devem ser marcados como "em breve" ou ocultos quando ainda nao houver implementacao real.

## Ultimas decisoes de produto

- O sistema e direcionado a escritorio de agrimensura.
- Undesk pode servir como referencia de UX, mas sem copiar marca, logo, nomes protegidos ou layout identico.
- O fluxo central desejado e: Proposta -> Contrato -> Servico -> Financeiro.
- O Kanban tecnico deve continuar sendo parte central do produto.
- Deve existir uma area futura chamada "Minha Empresa".
- O sistema deve evoluir para documentos por cliente/imovel.
- Deve existir futuramente uma area de mapa com upload KML/KMZ e visualizacao de perimetros.
- Supabase Auth, Database e Storage permanecem como fundacao.
- Chaves secretas nunca devem ser expostas.
- `.env.local` nao deve ser commitado.

## Proximos passos planejados

1. Aplicar a migration `002_contracts_conversion_flow.sql` no Supabase real, se ainda nao aplicada.
2. Testar manualmente a Fase 1:
   - criar proposta;
   - converter proposta;
   - verificar contrato;
   - verificar card em servicos;
   - verificar receita pendente no financeiro;
   - clicar duas vezes e confirmar que nao duplica.
3. Evoluir para Fase 2: area "Minha Empresa".
4. Evoluir propostas v2 com botao "Nova Proposta", upload PDF e criacao por modelo.
5. Preparar documentos de cliente/imovel.
6. Evoluir dashboard gerencial.
7. Preparar mapa com KML/KMZ.
