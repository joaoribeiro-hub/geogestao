-- FASE: Ajustes de isolamento por empresa, documentos e anexos.
-- Execute primeiro no Supabase de teste.

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

alter table if exists public.document_templates
  add column if not exists is_global boolean not null default false,
  add column if not exists bucket text not null default 'attachments',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;

alter table if exists public.legislation_items
  add column if not exists is_global boolean not null default false,
  add column if not exists file_path text,
  add column if not exists bucket text not null default 'attachments',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;

alter table if exists public.attachments
  add column if not exists is_global boolean not null default false;

update public.document_templates
set
  storage_path = coalesce(storage_path, file_path),
  file_name = coalesce(file_name, nullif(regexp_replace(coalesce(file_path, ''), '^.*/', ''), ''))
where storage_path is null
   or file_name is null;

update public.legislation_items
set
  storage_path = coalesce(storage_path, file_path),
  file_name = coalesce(file_name, nullif(regexp_replace(coalesce(file_path, ''), '^.*/', ''), ''))
where storage_path is null
   or file_name is null;

create index if not exists document_templates_org_global_idx
  on public.document_templates(organization_id, is_global, updated_at desc);

create index if not exists legislation_items_org_global_idx
  on public.legislation_items(organization_id, is_global, updated_at desc);

create index if not exists attachments_org_global_idx
  on public.attachments(organization_id, is_global, created_at desc);

drop policy if exists "document_templates_crud_authenticated" on public.document_templates;
drop policy if exists "document_templates_select_org" on public.document_templates;
drop policy if exists "document_templates_insert_org" on public.document_templates;
drop policy if exists "document_templates_update_org" on public.document_templates;
drop policy if exists "document_templates_delete_org" on public.document_templates;

create policy "document_templates_select_org" on public.document_templates
for select to authenticated
using (
  is_global = true
  or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
);

create policy "document_templates_insert_org" on public.document_templates
for insert to authenticated
with check (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_owner_or_admin(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
);

create policy "document_templates_update_org" on public.document_templates
for update to authenticated
using (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_owner_or_admin(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
)
with check (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_owner_or_admin(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
);

create policy "document_templates_delete_org" on public.document_templates
for delete to authenticated
using (
  is_global = false
  and organization_id is not null
  and public.is_org_owner_or_admin(organization_id, auth.uid())
);

drop policy if exists "legislation_items_crud_authenticated" on public.legislation_items;
drop policy if exists "legislation_items_select_org" on public.legislation_items;
drop policy if exists "legislation_items_insert_org" on public.legislation_items;
drop policy if exists "legislation_items_update_org" on public.legislation_items;
drop policy if exists "legislation_items_delete_org" on public.legislation_items;

create policy "legislation_items_select_org" on public.legislation_items
for select to authenticated
using (
  is_global = true
  or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
);

create policy "legislation_items_insert_org" on public.legislation_items
for insert to authenticated
with check (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_owner_or_admin(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
);

create policy "legislation_items_update_org" on public.legislation_items
for update to authenticated
using (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_owner_or_admin(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
)
with check (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_owner_or_admin(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
);

create policy "legislation_items_delete_org" on public.legislation_items
for delete to authenticated
using (
  is_global = false
  and organization_id is not null
  and public.is_org_owner_or_admin(organization_id, auth.uid())
);

drop policy if exists "attachments_crud_authenticated" on public.attachments;
drop policy if exists "attachments_select_org" on public.attachments;
drop policy if exists "attachments_insert_org" on public.attachments;
drop policy if exists "attachments_update_org" on public.attachments;
drop policy if exists "attachments_delete_org" on public.attachments;

create policy "attachments_select_org" on public.attachments
for select to authenticated
using (
  is_global = true
  or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
);

create policy "attachments_insert_org" on public.attachments
for insert to authenticated
with check (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_member(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
);

create policy "attachments_update_org" on public.attachments
for update to authenticated
using (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_member(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
)
with check (
  (
    is_global = false
    and organization_id is not null
    and public.is_org_member(organization_id, auth.uid())
  )
  or (
    is_global = true
    and organization_id is null
    and public.is_global_admin()
  )
);

create policy "attachments_delete_org" on public.attachments
for delete to authenticated
using (
  is_global = false
  and organization_id is not null
  and public.is_org_member(organization_id, auth.uid())
);

drop policy if exists "storage_attachments_select_authenticated" on storage.objects;
drop policy if exists "storage_attachments_insert_authenticated" on storage.objects;
drop policy if exists "storage_attachments_update_authenticated" on storage.objects;
drop policy if exists "storage_attachments_delete_authenticated" on storage.objects;
drop policy if exists "storage_attachments_select_org" on storage.objects;
drop policy if exists "storage_attachments_insert_org" on storage.objects;
drop policy if exists "storage_attachments_update_org" on storage.objects;
drop policy if exists "storage_attachments_delete_org" on storage.objects;

create policy "storage_attachments_select_org" on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    name like 'shared/%'
    or exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
        and name like ('organizations/' || om.organization_id::text || '/%')
    )
  )
);

create policy "storage_attachments_insert_org" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (
    (
      name like 'organizations/%'
      and exists (
        select 1
        from public.organization_members om
        where om.user_id = auth.uid()
          and om.status = 'active'
          and name like ('organizations/' || om.organization_id::text || '/%')
      )
    )
    or (
      name like 'shared/%'
      and public.is_global_admin()
    )
  )
);

create policy "storage_attachments_update_org" on storage.objects
for update to authenticated
using (
  bucket_id = 'attachments'
  and (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
        and name like ('organizations/' || om.organization_id::text || '/%')
    )
    or (name like 'shared/%' and public.is_global_admin())
  )
)
with check (
  bucket_id = 'attachments'
  and (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
        and name like ('organizations/' || om.organization_id::text || '/%')
    )
    or (name like 'shared/%' and public.is_global_admin())
  )
);

create policy "storage_attachments_delete_org" on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
        and name like ('organizations/' || om.organization_id::text || '/%')
    )
    or (name like 'shared/%' and public.is_global_admin())
  )
);

notify pgrst, 'reload schema';
