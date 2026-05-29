-- FASE: UX-CLEAN-COMPANY-KNOWLEDGE-1
-- Bases internas padrao, status profissionais e suporte a paginas markdown.
-- Execute primeiro no Supabase de teste.

alter table public.company_knowledge_categories
  add column if not exists sort_order integer;

update public.company_knowledge_categories
set sort_order = coalesce(sort_order, position, 0)
where sort_order is null;

alter table public.company_knowledge_items
  add column if not exists slug text,
  add column if not exists content jsonb,
  add column if not exists content_markdown text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.company_knowledge_items
set status = 'atualizado'
where status in ('active', 'ativo');

update public.company_knowledge_items
set slug = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
where slug is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_knowledge_items_status_check'
      and conrelid = 'public.company_knowledge_items'::regclass
  ) then
    alter table public.company_knowledge_items
      add constraint company_knowledge_items_status_check
      check (status in ('em_revisao', 'em_desenvolvimento', 'atualizado', 'nao_iniciada'));
  end if;
end $$;

create index if not exists company_knowledge_items_org_category_slug_idx
  on public.company_knowledge_items(organization_id, category_id, slug);

with default_categories(name, slug, position) as (
  values
    ('Regras e Diretrizes', 'regras-diretrizes', 1),
    ('Cultura', 'cultura', 2),
    ('Acessos', 'acessos', 3),
    ('Reunioes', 'reunioes', 4),
    ('Hierarquia', 'hierarquia', 5),
    ('Procedimentos Gerais', 'procedimentos-gerais', 6)
)
update public.company_knowledge_categories c
set
  name = d.name,
  position = d.position,
  sort_order = d.position
from default_categories d
where c.slug = d.slug;

with default_categories(name, slug, position) as (
  values
    ('Regras e Diretrizes', 'regras-diretrizes', 1),
    ('Cultura', 'cultura', 2),
    ('Acessos', 'acessos', 3),
    ('Reunioes', 'reunioes', 4),
    ('Hierarquia', 'hierarquia', 5),
    ('Procedimentos Gerais', 'procedimentos-gerais', 6)
)
insert into public.company_knowledge_categories (organization_id, name, slug, position, sort_order)
select o.id, d.name, d.slug, d.position, d.position
from public.organizations o
cross join default_categories d
where not exists (
  select 1
  from public.company_knowledge_categories existing
  where existing.organization_id = o.id
    and existing.slug = d.slug
);

with default_pages(category_slug, title, page_slug, status, position) as (
  values
    ('regras-diretrizes', 'Politica de Vestimenta', 'politica-de-vestimenta', 'em_desenvolvimento', 1),
    ('regras-diretrizes', 'Codigo de Conduta', 'codigo-de-conduta', 'em_revisao', 2),
    ('regras-diretrizes', 'LGPD', 'lgpd', 'atualizado', 3),
    ('regras-diretrizes', 'Horario de Funcionamento', 'horario-de-funcionamento', 'atualizado', 4),
    ('regras-diretrizes', 'Regras da Empresa', 'regras-da-empresa', 'atualizado', 5),
    ('cultura', 'Historia da Empresa', 'historia-da-empresa', 'nao_iniciada', 1),
    ('cultura', 'Atividades e Eventos Corporativos', 'atividades-e-eventos-corporativos', 'nao_iniciada', 2),
    ('cultura', 'Responsabilidade Social', 'responsabilidade-social', 'nao_iniciada', 3),
    ('cultura', 'Senha de Acesso Porta Escritorio', 'senha-de-acesso-porta-escritorio-cultura', 'em_revisao', 4),
    ('acessos', 'Senha do Wi-Fi', 'senha-do-wi-fi', 'em_revisao', 1),
    ('acessos', 'Senha de Acesso Porta Escritorio', 'senha-de-acesso-porta-escritorio', 'em_revisao', 2),
    ('reunioes', '[Semanal] Reuniao 1:1', 'semanal-reuniao-1-1', 'atualizado', 1),
    ('reunioes', '[Anual] Reuniao de Metas', 'anual-reuniao-de-metas', 'atualizado', 2),
    ('reunioes', '[Semanal] Reuniao de Metas', 'semanal-reuniao-de-metas', 'atualizado', 3),
    ('reunioes', '[Semanal] Reuniao de Marketing', 'semanal-reuniao-de-marketing', 'atualizado', 4),
    ('reunioes', '[Mensal] Reuniao de Financas', 'mensal-reuniao-de-financas', 'atualizado', 5),
    ('hierarquia', 'Diretor Projetos', 'diretor-projetos', 'atualizado', 1),
    ('hierarquia', 'Estagiario', 'estagiario', 'atualizado', 2),
    ('hierarquia', 'Diretor de R.H.', 'diretor-de-rh', 'atualizado', 3),
    ('hierarquia', 'Diretor de Processos', 'diretor-de-processos', 'atualizado', 4),
    ('hierarquia', 'Cargo Financeiro Adm', 'cargo-financeiro-adm', 'atualizado', 5),
    ('hierarquia', 'Diretor Comercial', 'diretor-comercial', 'atualizado', 6),
    ('hierarquia', 'CEO', 'ceo', 'atualizado', 7),
    ('hierarquia', 'Diretor Marketing', 'diretor-marketing', 'atualizado', 8),
    ('procedimentos-gerais', 'Como Utilizar o Notion', 'como-utilizar-o-notion', 'nao_iniciada', 1),
    ('procedimentos-gerais', 'Como Solicitar Material', 'como-solicitar-material', 'nao_iniciada', 2)
)
insert into public.company_knowledge_items (
  organization_id,
  category_id,
  title,
  slug,
  status,
  description,
  content_markdown,
  created_at,
  updated_at
)
select
  c.organization_id,
  c.id,
  p.title,
  p.page_slug,
  p.status,
  'Pagina padrao da base interna da empresa.',
  '',
  now(),
  now()
from public.company_knowledge_categories c
join default_pages p on p.category_slug = c.slug
where not exists (
  select 1
  from public.company_knowledge_items existing
  where existing.organization_id = c.organization_id
    and existing.category_id = c.id
    and existing.slug = p.page_slug
);

create or replace function public.seed_company_knowledge_defaults(p_organization_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  with default_categories(name, slug, position) as (
    values
      ('Regras e Diretrizes', 'regras-diretrizes', 1),
      ('Cultura', 'cultura', 2),
      ('Acessos', 'acessos', 3),
      ('Reunioes', 'reunioes', 4),
      ('Hierarquia', 'hierarquia', 5),
      ('Procedimentos Gerais', 'procedimentos-gerais', 6)
  )
  update public.company_knowledge_categories c
  set
    name = d.name,
    position = d.position,
    sort_order = d.position
  from default_categories d
  where c.organization_id = p_organization_id
    and c.slug = d.slug;

  with default_categories(name, slug, position) as (
    values
      ('Regras e Diretrizes', 'regras-diretrizes', 1),
      ('Cultura', 'cultura', 2),
      ('Acessos', 'acessos', 3),
      ('Reunioes', 'reunioes', 4),
      ('Hierarquia', 'hierarquia', 5),
      ('Procedimentos Gerais', 'procedimentos-gerais', 6)
  )
  insert into public.company_knowledge_categories (organization_id, name, slug, position, sort_order)
  select p_organization_id, d.name, d.slug, d.position, d.position
  from default_categories d
  where not exists (
    select 1
    from public.company_knowledge_categories existing
    where existing.organization_id = p_organization_id
      and existing.slug = d.slug
  );

  with default_pages(category_slug, title, page_slug, status, position) as (
    values
      ('regras-diretrizes', 'Politica de Vestimenta', 'politica-de-vestimenta', 'em_desenvolvimento', 1),
      ('regras-diretrizes', 'Codigo de Conduta', 'codigo-de-conduta', 'em_revisao', 2),
      ('regras-diretrizes', 'LGPD', 'lgpd', 'atualizado', 3),
      ('regras-diretrizes', 'Horario de Funcionamento', 'horario-de-funcionamento', 'atualizado', 4),
      ('regras-diretrizes', 'Regras da Empresa', 'regras-da-empresa', 'atualizado', 5),
      ('cultura', 'Historia da Empresa', 'historia-da-empresa', 'nao_iniciada', 1),
      ('cultura', 'Atividades e Eventos Corporativos', 'atividades-e-eventos-corporativos', 'nao_iniciada', 2),
      ('cultura', 'Responsabilidade Social', 'responsabilidade-social', 'nao_iniciada', 3),
      ('cultura', 'Senha de Acesso Porta Escritorio', 'senha-de-acesso-porta-escritorio-cultura', 'em_revisao', 4),
      ('acessos', 'Senha do Wi-Fi', 'senha-do-wi-fi', 'em_revisao', 1),
      ('acessos', 'Senha de Acesso Porta Escritorio', 'senha-de-acesso-porta-escritorio', 'em_revisao', 2),
      ('reunioes', '[Semanal] Reuniao 1:1', 'semanal-reuniao-1-1', 'atualizado', 1),
      ('reunioes', '[Anual] Reuniao de Metas', 'anual-reuniao-de-metas', 'atualizado', 2),
      ('reunioes', '[Semanal] Reuniao de Metas', 'semanal-reuniao-de-metas', 'atualizado', 3),
      ('reunioes', '[Semanal] Reuniao de Marketing', 'semanal-reuniao-de-marketing', 'atualizado', 4),
      ('reunioes', '[Mensal] Reuniao de Financas', 'mensal-reuniao-de-financas', 'atualizado', 5),
      ('hierarquia', 'Diretor Projetos', 'diretor-projetos', 'atualizado', 1),
      ('hierarquia', 'Estagiario', 'estagiario', 'atualizado', 2),
      ('hierarquia', 'Diretor de R.H.', 'diretor-de-rh', 'atualizado', 3),
      ('hierarquia', 'Diretor de Processos', 'diretor-de-processos', 'atualizado', 4),
      ('hierarquia', 'Cargo Financeiro Adm', 'cargo-financeiro-adm', 'atualizado', 5),
      ('hierarquia', 'Diretor Comercial', 'diretor-comercial', 'atualizado', 6),
      ('hierarquia', 'CEO', 'ceo', 'atualizado', 7),
      ('hierarquia', 'Diretor Marketing', 'diretor-marketing', 'atualizado', 8),
      ('procedimentos-gerais', 'Como Utilizar o Notion', 'como-utilizar-o-notion', 'nao_iniciada', 1),
      ('procedimentos-gerais', 'Como Solicitar Material', 'como-solicitar-material', 'nao_iniciada', 2)
  )
  insert into public.company_knowledge_items (
    organization_id,
    category_id,
    title,
    slug,
    status,
    description,
    content_markdown
  )
  select
    c.organization_id,
    c.id,
    p.title,
    p.page_slug,
    p.status,
    'Pagina padrao da base interna da empresa.',
    ''
  from public.company_knowledge_categories c
  join default_pages p on p.category_slug = c.slug
  where c.organization_id = p_organization_id
    and not exists (
      select 1
      from public.company_knowledge_items existing
      where existing.organization_id = c.organization_id
        and existing.category_id = c.id
        and existing.slug = p.page_slug
    );
end;
$$;

create or replace function public.handle_seed_company_knowledge_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.seed_company_knowledge_defaults(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_seed_company_knowledge_defaults on public.organizations;
create trigger organizations_seed_company_knowledge_defaults
after insert on public.organizations
for each row
execute function public.handle_seed_company_knowledge_defaults();

notify pgrst, 'reload schema';
