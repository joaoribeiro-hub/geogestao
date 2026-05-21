-- FASE AUTH-ORG-PLANS-1 - correcao de criacao de empresa no onboarding.
-- Execute primeiro no Supabase de teste.

create extension if not exists pgcrypto;

alter table if exists public.company_settings
  drop constraint if exists company_settings_singleton_key_key;

create unique index if not exists company_settings_organization_singleton_key_idx
  on public.company_settings(organization_id, singleton_key);

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_document_number text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_city text default null,
  p_state text default null,
  p_notes text default null
)
returns table (
  organization_id uuid,
  join_code text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_org_id uuid;
  v_code text;
  v_storage_limit integer;
  v_step text := 'inicio';
begin
  raise log '[ONBOARDING:RPC] Iniciando cadastro de empresa. user_id=%', v_user_id;

  if v_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.user_id = v_user_id
      and om.status = 'active'
  ) then
    raise exception 'Este usuario ja participa de uma empresa.';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Informe o nome da empresa.';
  end if;

  v_step := 'buscar_plano_iniciante';
  select id, coalesce(storage_limit_mb, storage_quota_mb, 3072)
  into v_plan_id, v_storage_limit
  from public.plans
  where slug = 'iniciante'
  limit 1;

  if v_plan_id is null then
    raise exception 'Plano Iniciante nao encontrado.';
  end if;

  v_step := 'gerar_codigo_empresa';
  v_code := public.generate_organization_join_code();

  v_step := 'insert_organizations';
  insert into public.organizations (
    name,
    trade_name,
    slug,
    document_number,
    owner_user_id,
    plan_id,
    storage_quota_mb,
    status
  )
  values (
    trim(p_name),
    trim(p_name),
    public.make_organization_slug(p_name),
    nullif(trim(coalesce(p_document_number, '')), ''),
    v_user_id,
    v_plan_id,
    v_storage_limit,
    'active'
  )
  returning id into v_org_id;

  raise log '[ONBOARDING:RPC] Empresa criada. organization_id=%', v_org_id;

  v_step := 'insert_organization_join_codes';
  insert into public.organization_join_codes (organization_id, code, status, created_by)
  values (v_org_id, v_code, 'active', v_user_id);

  v_step := 'insert_organization_members';
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  v_step := 'update_profiles';
  update public.profiles
  set
    organization_id = v_org_id,
    onboarding_status = 'complete',
    updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Profile do usuario autenticado nao encontrado.';
  end if;

  v_step := 'upsert_company_settings';
  insert into public.company_settings (
    organization_id,
    singleton_key,
    trade_name,
    legal_name,
    cnpj,
    phone,
    email,
    address,
    city,
    state,
    notes
  )
  values (
    v_org_id,
    'default',
    trim(p_name),
    trim(p_name),
    nullif(trim(coalesce(p_document_number, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  on conflict (organization_id, singleton_key) do update
  set
    trade_name = excluded.trade_name,
    legal_name = excluded.legal_name,
    cnpj = excluded.cnpj,
    phone = excluded.phone,
    email = excluded.email,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    notes = excluded.notes,
    updated_at = now();

  v_step := 'insert_organization_subscriptions';
  insert into public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_start,
    billing_interval,
    provider
  )
  values (v_org_id, v_plan_id, 'active', now(), 'monthly', 'manual')
  on conflict do nothing;

  v_step := 'insert_audit_logs';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'organization.created',
    'organization',
    v_org_id,
    jsonb_build_object('source', 'onboarding', 'plan', 'iniciante')
  );

  raise log '[ONBOARDING:RPC] Cadastro concluido. organization_id=%', v_org_id;

  organization_id := v_org_id;
  join_code := v_code;
  return next;
exception
  when others then
    raise exception 'Falha no cadastro da empresa na etapa %: %', v_step, sqlerrm
      using errcode = sqlstate;
end;
$$;

revoke all on function public.create_organization_for_current_user(text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_organization_for_current_user(text, text, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
