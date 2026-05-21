-- FASE AUTH-ORG-PLANS-1 - correcao do gerador de codigo da empresa.
-- Execute primeiro no Supabase de teste.

create or replace function public.generate_organization_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (
      select 1 from public.organization_join_codes where code = candidate
    );
  end loop;
  return candidate;
end;
$$;

notify pgrst, 'reload schema';
