# Desenvolvedor da plataforma

## Papel tecnico

`platform developer` e um papel global do GeoGestao. Ele nao e derivado de `organization_members.role` e, portanto, nao e concedido automaticamente a owner ou admin de empresa.

Somente um desenvolvedor ativo pode acessar:

- `/sistema/workers`;
- `/sophia/aprendizados`;
- `/sophia/evals`;
- APIs de infraestrutura e revisao global;
- criacao e remocao de documentos universais;
- criacao e remocao de avisos universais.

Menu, paginas server-side, APIs e RLS verificam esse papel. Esconder o item no menu nao e usado como mecanismo de seguranca.

## Cadastrar a primeira conta

Depois de aplicar `060_platform_developer_universal_content.sql` e com a conta ja criada no Supabase Auth, execute no SQL Editor, substituindo apenas o placeholder:

```sql
insert into public.platform_developers (user_id, email, role, is_active)
select id, email, 'developer', true
from auth.users
where lower(email) = lower('MEU_EMAIL_AQUI')
on conflict (user_id) do update set
  email = excluded.email,
  role = 'developer',
  is_active = true;
```

Confirme sem expor dados de outras contas:

```sql
select pd.user_id, pd.email, pd.role, pd.is_active
from public.platform_developers pd
where lower(pd.email) = lower('MEU_EMAIL_AQUI');
```

O fallback `PLATFORM_DEVELOPER_EMAILS` e opcional e funciona apenas fora de producao. A tabela e a fonte canonica. Nenhum e-mail real fica no codigo.

## Teste de acesso

1. Entre como membro ou owner de empresa e confirme que os tres itens tecnicos nao aparecem.
2. Tente chamar `/api/system/workers`: a resposta deve ser `403`.
3. Entre com a conta cadastrada em `platform_developers` e confirme menu, paginas e APIs.
4. Desative `is_active` e confirme que o acesso desaparece na proxima sessao/requisicao.

