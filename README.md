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
- Leaflet
- OpenStreetMap
- @tmcw/togeojson
- JSZip

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
- `supabase/migrations/003_phase1_repair_contracts_conversion_flow.sql` se a migration 002 falhou ou se o banco remoto ja tinha dados duplicados da Fase 1
- `supabase/migrations/004_phase1_payment_and_service_repair.sql` para a regra atual da Fase 1: converter cria contrato + servico, pagamento efetuado cria receita
- `supabase/migrations/005_company_area.sql` para a area Minha Empresa
- `supabase/migrations/006_map_properties_geometries.sql` para o mapa com imoveis e geometrias KML/KMZ
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
- Minha Empresa com informacoes da empresa, clientes espelhados e servicos/nichos basicos.
- CRM com clientes PF/PJ, busca, detalhe, edicao, exclusao e historico de interacoes.
- Propostas comerciais com cards de resumo, grafico simples por status, criacao por PDF/modelo e Kanban com drag and drop persistente.
- Propostas possuem tipo de servico: `georreferenciamento`, `car`, `itr_ccir` ou `outros_servicos`.
- Contratos vinculados a cliente, proposta, servico e receita prevista.
- Servicos tecnicos com quadros, colunas, cards, historico de movimentacao e checklists.
- Anexos privados via Supabase Storage e tabela `attachments`.
- Financeiro basico com receitas, despesas, contas a receber/pagar, resumo mensal e resumo por projeto.
- Biblioteca de documentos com busca.
- Biblioteca de legislacao com busca por palavra-chave.
- Mapa com upload KML/KMZ, conversao para GeoJSON e visualizacao em Leaflet/OpenStreetMap.
- Dashboard com indicadores, vencimentos e projetos atrasados.

## Fluxo proposta -> contrato -> servico -> financeiro

Status da Fase 1: parcial ate a migration `004_phase1_payment_and_service_repair.sql` ser aplicada no Supabase real e o teste manual ser refeito.

Ao converter uma proposta em servico, o sistema:

- atualiza a proposta para `execution`;
- cria ou reaproveita um contrato vinculado a proposta;
- cria ou reaproveita um card tecnico no quadro definido pelo tipo de servico da proposta;
- coloca o card na primeira coluna ativa do quadro tecnico;
- vincula `client_id`, `proposal_id` e `contract_id` ao card tecnico;
- define `payment_status` como `pagamento_nao_efetuado`;
- registra eventos em `audit_logs`;
- evita duplicidade quando o usuario clica mais de uma vez.
- tambem executa a conversao quando a proposta e arrastada para `Propostas em Execucao`.

Converter em servico nao cria receita automaticamente.

Ao clicar em "Pagamento efetuado", o sistema:

- cria ou reaproveita uma unica receita automatica no Financeiro;
- grava a receita com `status = paid`;
- preenche `paid_at` com a data atual;
- vincula receita a cliente, proposta, contrato e card tecnico;
- atualiza proposta e card tecnico para `pagamento_efetuado`;
- evita duplicidade quando o usuario clica mais de uma vez.

Ao clicar em "Voltar" na proposta ou "Voltar servico" no card tecnico, o sistema:

- retorna a proposta para `Propostas Enviadas`;
- marca o contrato como `cancelado`;
- remove o card tecnico criado pela conversao;
- remove receitas automaticas vinculadas a proposta;
- volta `payment_status` para `pagamento_nao_efetuado`;
- registra `audit_logs`.

Para habilitar esse fluxo em um banco ja existente, execute a migration:

```sql
-- Supabase SQL Editor
-- conteudo de supabase/migrations/004_phase1_payment_and_service_repair.sql
```

Se aparecer `Could not find the table 'public.contracts' in the schema cache`, a migration da Fase 1 ainda nao foi aplicada com sucesso no Supabase real ou o PostgREST ainda nao recarregou o schema. A migration de reparo termina com `notify pgrst, 'reload schema';`.

## Mapa com KML/KMZ

Antes de testar a aba Mapa em um Supabase real, execute no SQL Editor o conteudo completo de:

```text
supabase/migrations/006_map_properties_geometries.sql
```

Depois:

1. Acesse `/mapa`.
2. Selecione um cliente.
3. Opcionalmente vincule um servico/card tecnico.
4. Preencha nome do imovel, area, matricula, data da matricula, CAR Estadual, CAR Federal, municipio, UF e observacoes.
5. Envie um arquivo `.kml` simples ou `.kmz` com KML interno.
6. Confirme que o perimetro aparece no mapa.
7. Clique no perimetro e confira cliente, imovel, servico, area, matricula, CARs e link para abrir o servico.

O mapa usa Leaflet com OpenStreetMap como camada inicial. A arquitetura fica preparada para camada de satelite futura via provedor com API adequada. O KML/KMZ original e salvo no bucket privado `attachments`, e o GeoJSON derivado e salvo em `property_geometries`.

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
- Evoluir o wizard de propostas ate pre-visualizacao e geracao de PDF.
- Documentos por cliente/imovel e categorias documentais.
- Dashboard avancado com filtros e graficos.
- Camada de satelite futura no mapa via provedor com API adequada.
- Testes automatizados de actions e fluxos criticos.
- Equipe, bancos, armazenamento e variaveis financeiras avancadas dentro de Minha Empresa.
