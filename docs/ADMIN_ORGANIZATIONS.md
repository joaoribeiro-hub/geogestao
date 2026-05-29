# GeoGestao - Administracao de Organizacoes

## Conceito

O GeoGestao usa um unico Supabase com isolamento progressivo por `organization_id`.
Nao deve ser criado um projeto Supabase por empresa cliente.

Dados operacionais de uma empresa devem pertencer a uma organizacao:

- clientes;
- servicos;
- propostas;
- contratos;
- financeiro;
- anexos;
- documentos;
- propriedades/imoveis vinculados.

Bases tecnicas globais, como CAR, SIGEF/INCRA, MapBiomas e camadas oficiais, permanecem compartilhadas e nao devem ser resetadas pela rotina operacional.

## Migration da fase

Execute no Supabase de teste:

```sql
-- supabase/migrations/015_ux_org_services_center.sql
```

Essa migration:

- adiciona `organizations.slug`;
- cria ou garante a organizacao `Terras Reunidas` com slug `terras-reunidas`;
- cria `service_members`;
- cria `service_events`;
- ajusta as colunas do quadro de Georreferenciamento;
- recarrega o schema cache do PostgREST.

Ela depende da migration ACCOUNT-1 (`008_account1_organizations_profiles_ai.sql`), pois usa `organizations`, `plans`, `organization_members` e `public.is_organization_member`.

Depois execute a migration corretiva:

```sql
-- supabase/migrations/016_services_workflow_company_team_permissions.sql
```

Essa migration:

- garante as colunas iniciais de Servicos para Georreferenciamento, CAR, ITR/CCIR e Outros Servicos;
- cria `public.is_organization_manager`;
- adiciona dados bancarios em `company_settings`;
- cria `team_members` e `recurring_expenses`;
- adiciona vinculo opcional de despesa com membro da equipe;
- restringe edicao de `company_settings`, equipe e recorrencias a `owner`/`admin`.

Depois execute a migration corretiva de RLS/financeiro:

```sql
-- supabase/migrations/017_org_members_rls_service_lost_finance.sql
```

Essa migration:

- corrige recursao de RLS em `organization_members`;
- recria policies usando funcoes `SECURITY DEFINER`;
- garante que apenas `owner`/`admin` editem Minha Empresa e equipe;
- adiciona a coluna `Servico perdido` nos fluxos de Servicos;
- prepara indice para receita automatica vinculada a `service_card_id`.

Depois execute a migration de permissao owner/admin:

```sql
-- supabase/migrations/018_company_owner_only_permissions.sql
```

Essa migration:

- cria `public.is_org_owner`;
- deixa somente `role = owner` editar Minha Empresa, Informacoes, Equipe, Variaveis financeiras, dados bancarios e regras da empresa;
- deixa `role = admin` visualizar Minha Empresa e operar os demais modulos do sistema;
- vincula `flavio.terras@gmail.com` como `owner` da Terras Reunidas, quando o usuario existir no Auth;
- vincula `nataliasilva.terras@gmail.com` e `romeu@teste.com.br` como `admin`, quando existirem no Auth;
- nao usa `role = member`.

Depois execute a migration de documentos/anexos por organizacao:

```sql
-- supabase/migrations/019_documents_attachments_org_storage.sql
```

Essa migration:

- adiciona metadados de arquivo e `is_global` em Documentos, Legislacao e Anexos;
- separa arquivos da empresa de arquivos globais/oficiais;
- recria policies de documentos/legislacao/anexos para leitura por membros da organizacao e leitura global de oficiais;
- restringe criacao/edicao/exclusao de globais a admin global;
- restringe paths de Storage por `organizations/{organization_id}/...` ou `shared/...`;
- remove a policy ampla antiga de Storage que permitia qualquer usuario autenticado acessar todo o bucket.

Depois execute a migration de data operacional e atraso de servicos:

```sql
-- supabase/migrations/020_services_operational_date_overdue_delete.sql
```

Essa migration:

- adiciona `service_cards.service_date` com default `current_date`;
- adiciona `service_cards.completed_at`;
- preenche `service_date` de dados antigos com `created_at::date`;
- adiciona a coluna `Em atraso` em todos os fluxos de Servicos;
- reposiciona as colunas de cada quadro;
- cria indices de apoio para filtros por data operacional e prazo.

Depois execute a migration de cadastro publico/onboarding/planos:

```sql
-- supabase/migrations/023_auth_org_plans_onboarding.sql
```

Essa migration:

- adiciona `profiles.email`, `profiles.cpf` e `profiles.onboarding_status`;
- altera `public.handle_new_user()` para criar profile sem organizacao;
- cria `organization_join_codes`;
- cria `organization_subscriptions` e `billing_orders`;
- prepara o plano `Iniciante` com limite de 3 usuarios ativos;
- cria RPCs `create_organization_for_current_user` e `join_organization_by_code`;
- cria RPC `can_request_password_reset`;
- restringe atualizacao de `organizations` ao `owner`;
- recarrega o schema cache do Supabase/PostgREST.

Depois execute a migration corretiva do onboarding:

```sql
-- supabase/migrations/024_onboarding_company_creation_debug_fix.sql
```

Essa migration:

- remove a constraint antiga `company_settings_singleton_key_key`, que era global e incompatível com multiempresa;
- garante unicidade por `company_settings(organization_id, singleton_key)`;
- recria a RPC `public.create_organization_for_current_user` com etapas nomeadas e erro indicando onde falhou;
- mantém a criação transacional de organizacao, codigo, membership owner, profile, settings, assinatura inicial e auditoria.

Se o ambiente Supabase nao tiver `gen_random_bytes`, execute tambem:

```sql
-- supabase/migrations/025_onboarding_join_code_uuid_fix.sql
```

Essa migration recria `public.generate_organization_join_code()` usando `gen_random_uuid()`.

## Criar/vincular Terras Reunidas

Depois da migration, voce pode garantir a empresa e vincular um owner com:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto-de-teste.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="sua-service-role-do-projeto-de-teste"
npm run admin:ensure-terras -- --owner-email=voce@empresa.com
```

Nao grave `SUPABASE_SERVICE_ROLE_KEY` em arquivos versionados. Ela e permitida apenas em script local/admin.

Se preferir SQL manual:

```sql
select id, name, slug
from public.organizations
where slug = 'terras-reunidas';
```

Depois vincule o usuario desejado em `profiles.organization_id` e `organization_members`.

Para conferir quem e owner/admin da organizacao:

```sql
select
  o.id as organization_id,
  o.name,
  o.slug,
  om.user_id,
  om.role,
  om.status,
  p.full_name
from public.organizations o
join public.organization_members om on om.organization_id = o.id
left join public.profiles p on p.id = om.user_id
where o.slug = 'terras-reunidas'
order by om.role, p.full_name;
```

O owner/admin deve aparecer com `role` igual a `owner` ou `admin` e `status = active`.

Regra atual:

- `owner`: visualiza e edita configuracoes da empresa;
- `admin`: visualiza configuracoes da empresa e opera servicos, clientes, financeiro, propostas, contratos e documentos;
- outros papeis operacionais podem usar os modulos conforme RLS existente, mas nao editam Minha Empresa.

## Codigo/ID da empresa

Na fase `AUTH-ORG-PLANS-1`, cada organizacao pode ter um codigo ativo em `organization_join_codes`.

Regras:

- a interface chama esse codigo de "ID da empresa";
- somente `owner` ve e copia o codigo em Minha Empresa;
- `admin` operacional nao ve o codigo;
- usuario novo sem empresa pode informar o codigo no onboarding;
- entrada por codigo cria membership com `role = admin`;
- o plano Iniciante bloqueia a quarta conta ativa.

Para conferir o codigo ativo:

```sql
select o.name, o.slug, ojc.code, ojc.status, ojc.created_at
from public.organizations o
join public.organization_join_codes ojc on ojc.organization_id = o.id
where o.slug = 'terras-reunidas'
order by ojc.created_at desc;
```

Para conferir uso do plano:

```sql
select *
from public.get_organization_usage(
  (select id from public.organizations where slug = 'terras-reunidas')
);
```

## Reset seguro da organizacao

O script de reset sempre roda em dry-run por padrao:

```powershell
npm run admin:reset-org -- --slug=terras-reunidas
```

Para apagar dados operacionais da organizacao, rode explicitamente:

```powershell
npm run admin:reset-org -- --slug=terras-reunidas --confirm
```

O script mostra contagem por tabela antes de apagar.

Ele apaga somente dados operacionais da organizacao:

- clientes;
- interacoes;
- servicos;
- membros/eventos de servicos;
- membros operacionais da equipe;
- despesas recorrentes da equipe;
- checklists e itens dos servicos;
- movimentacoes dos servicos;
- propostas;
- contratos;
- receitas;
- despesas;
- anexos;
- documentos/modelos da organizacao;
- legislacao da organizacao;
- propriedades e geometrias da organizacao.

Ele nao apaga:

- usuarios/auth;
- profiles;
- organizacao;
- organization_members;
- plans;
- bases CAR/SIGEF/MapBiomas;
- camadas geograficas globais;
- migrations.

## Storage por empresa

Novos uploads gerados pelo helper padrao usam:

```text
organizations/{organization_id}/clients/{client_id}/...
organizations/{organization_id}/services/{service_id}/...
organizations/{organization_id}/contracts/{contract_id}/...
organizations/{organization_id}/proposals/{proposal_id}/...
organizations/{organization_id}/finance/revenues/{revenue_id}/...
organizations/{organization_id}/finance/expenses/{expense_id}/...
organizations/{organization_id}/general/...
```

No Supabase Storage, essas "pastas" sao caminhos logicos criados quando ha upload. Nao e necessario criar pasta vazia antes.

Arquivos globais compartilhados devem usar futuramente:

```text
shared/official-documents/...
shared/legislation/...
shared/templates/...
```

Documentos globais oficiais devem ser somente leitura para usuarios comuns e editaveis apenas por admin global em fase futura.

## Documentos, legislacao e anexos

Arquivos da empresa usam:

```text
organizations/{organization_id}/documents/...
organizations/{organization_id}/legislation/...
organizations/{organization_id}/attachments/...
organizations/{organization_id}/clients/{client_id}/...
organizations/{organization_id}/clients/{client_id}/properties/{property_id}/documents/...
organizations/{organization_id}/services/{service_id}/documents/...
organizations/{organization_id}/hr/{employee_id}/documents/...
```

Arquivos globais/oficiais usam:

```text
shared/official-documents/...
shared/legislation/...
shared/templates/...
```

Ao apagar um documento/anexo da empresa pelo app, o GeoGestao remove o registro e o objeto correspondente no Supabase Storage. O helper de seguranca bloqueia exclusao de path fora de `organizations/{organization_id}/`.

Documentos globais/oficiais aparecem para todas as empresas, mas nao podem ser apagados por usuarios da empresa.

Na fase `DOCUMENTS-STORAGE-ARCH-1`, documentos profissionais novos usam o bucket privado `documentos` e a tabela `documents`.
Anexos legados continuam no bucket `attachments` ate uma migracao futura sob demanda.

Ao apagar um servico pelo Kanban, o app remove propostas, contratos e receitas automaticas vinculadas ao servico, mas nao remove cliente, documentos do cliente, bases globais ou anexos do proprio servico nesta fase.

## Cuidados

- Rode tudo primeiro no Supabase de teste.
- Nao use o reset contra producao sem backup e revisao das contagens.
- Nao use `service_role` no frontend.
- Nao altere GeoQuery/CAR/SIGEF/MapBiomas ao resetar uma empresa operacional.

## Diagnostico de dados antigos sem organizacao

Se usuarios novos vinculados a `Terras Reunidas` nao veem dados antigos, isso geralmente esta correto: as telas filtram por `organization_id`.

Para diagnosticar no Supabase de teste:

```sql
select count(*) as servicos_sem_organizacao
from public.service_cards
where organization_id is null;

select organization_id, count(*)
from public.service_cards
group by organization_id;
```

Novos servicos criados pelo app devem salvar `organization_id` da organizacao atual. Dados antigos sem organizacao nao devem ser movidos automaticamente nesta fase.
