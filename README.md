# GeoGestao MVP

Sistema web para gestao de escritorio de agrimensura com CRM, propostas em Kanban, servicos tecnicos, financeiro basico, documentos, legislacao e anexos privados.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth, PostgreSQL e Storage
- dnd-kit
- Zod
- React Hook Form

## Como rodar

1. Instale dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

3. Configure `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica-opcional
```

Use apenas a publishable key ou anon key no frontend. Nao coloque service role key no `.env.local` usado pelo Next.js.

4. Rode migrations e seed no Supabase.

Com Supabase CLI local:

```bash
supabase start
supabase db reset
```

Ou, em um projeto remoto, execute o SQL de:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_contracts_conversion_flow.sql`
- `supabase/seed.sql`

5. Crie ao menos um usuario no Supabase Auth.

No painel do Supabase, crie um usuario por e-mail e senha. A trigger `handle_new_user` cria automaticamente o registro em `profiles`. Para tornar esse usuario admin, atualize o role:

```sql
update public.profiles
set role = 'admin'
where id = '<USER_ID_DO_AUTH>';
```

6. Inicie o app:

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Estrutura principal

- `src/app/(auth)/login`: login com Supabase Auth.
- `src/app/(app)`: rotas autenticadas.
- `src/components/forms`: formularios com React Hook Form e Zod.
- `src/components/kanban`: Kanbans com dnd-kit.
- `src/components/ui`: componentes base no estilo shadcn/ui.
- `src/lib/supabase`: clientes Supabase server/browser e middleware.
- `src/lib/schemas.ts`: validacoes Zod.
- `src/types/database.ts`: tipos TypeScript das entidades principais.
- `supabase/migrations`: schema, RLS, policies e storage.
- `supabase/seed.sql`: dados de exemplo.

## Modulos implementados

- Autenticacao protegida por middleware.
- `profiles` com roles: admin, gerente, tecnico, financeiro e leitura.
- CRM com clientes PF/PJ, busca, detalhe, edicao, exclusao e historico de interacoes.
- Propostas comerciais em Kanban com drag and drop persistente e conversao para servico.
- Contratos vinculados a cliente, proposta, servico e receita prevista.
- Servicos tecnicos com quadros, colunas, cards, historico de movimentacao e checklists.
- Anexos privados via Supabase Storage e tabela `attachments`.
- Financeiro basico com receitas, despesas, contas a receber/pagar, resumo mensal e resumo por projeto.
- Biblioteca de documentos com busca.
- Biblioteca de legislacao com busca por palavra-chave.
- Dashboard com indicadores, vencimentos e projetos atrasados.

## Fluxo proposta -> contrato -> servico -> financeiro

Ao converter uma proposta em servico, o sistema:

- atualiza a proposta para `execution`;
- cria ou reaproveita um contrato vinculado a proposta;
- cria ou reaproveita um card tecnico no quadro inferido pelo texto da proposta;
- vincula `client_id`, `proposal_id` e `contract_id` ao card tecnico;
- cria ou reaproveita uma receita pendente com categoria `Proposta aprovada`;
- vincula a receita ao cliente, proposta, contrato e card tecnico;
- registra eventos em `audit_logs`;
- evita duplicidade quando o usuario clica mais de uma vez.

Para habilitar esse fluxo em um banco ja existente, execute a migration:

```sql
-- Supabase SQL Editor
-- conteudo de supabase/migrations/002_contracts_conversion_flow.sql
```

## Seguranca

- Todas as tabelas principais tem Row Level Security ativado.
- As policies iniciais liberam CRUD para usuarios autenticados, adequadas para MVP interno de ate 10 usuarios.
- O bucket `attachments` e privado.
- Uploads usam Supabase Storage com policies para usuarios autenticados.
- Inputs sao validados com Zod no cliente e no servidor.
- Actions importantes registram eventos em `audit_logs`.

## Proximas melhorias recomendadas

- Politicas por role para separar admin, gerente, tecnico, financeiro e leitura.
- Telas de administracao de usuarios e perfis.
- Edicao completa de propostas, documentos e legislacao.
- Comentarios estruturados em propostas e cards de servico.
- Minha Empresa com cadastros internos.
- Propostas v2 com upload PDF, modelos e wizard.
- Documentos por cliente/imovel e categorias documentais.
- Dashboard avancado com filtros e graficos.
- Mapa com upload KML/KMZ e visualizacao de perimetros.
- Testes automatizados de actions e fluxos criticos.
