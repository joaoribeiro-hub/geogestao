# GeoGestao - Auth, Cadastro e Onboarding

## Conceito

A fase `AUTH-ORG-PLANS-1` muda o cadastro publico para criar usuario sem empresa.
Depois de confirmar o e-mail e entrar, o app fica em modo limitado ate o usuario:

- participar de uma empresa por codigo; ou
- cadastrar uma nova empresa.

Enquanto a conta nao tem `organization_id` e membership ativo, o usuario ve apenas Minha Conta, Onboarding e Sair.

## Cadastro publico

Na tela de login existem os atalhos:

- `Criar cadastro`;
- `Esqueci minha senha`.

O cadastro usa Supabase Auth `signUp` com:

- nome completo;
- e-mail;
- CPF;
- data de nascimento;
- senha;
- confirmacao de senha.

A trigger `public.handle_new_user()` cria ou atualiza `public.profiles`, mas nao cria organizacao automaticamente.
O profile novo fica com:

- `organization_id = null`;
- `onboarding_status = pending_organization`.

## Onboarding

Usuario confirmado e logado sem empresa e redirecionado para `/onboarding`.

Opcoes:

- Participar de uma empresa: usa o codigo de entrada da organizacao.
- Cadastrar empresa: cria uma organizacao vazia e torna o usuario `owner`.

Ao participar por codigo, o usuario entra como `admin` operacional.
O plano Iniciante limita a empresa a 3 usuarios ativos: 1 owner e ate 2 admins operacionais.

## Diagnostico de cadastro de empresa

O onboarding usa:

- empresa: `public.organizations`;
- vinculo usuario/empresa: `public.organization_members`;
- perfil do usuario: `public.profiles`;
- dados editaveis da empresa: `public.company_settings`;
- assinatura inicial: `public.organization_subscriptions`.

Se o cadastro mostrar erro e a empresa nao aparecer no Supabase, confira se a migration
`024_onboarding_company_creation_debug_fix.sql` foi aplicada depois da 023.
Ela corrige a constraint antiga de `company_settings.singleton_key`, que era global e podia abortar a transacao da RPC.

Se o erro for `function gen_random_bytes(integer) does not exist`, aplique tambem
`025_onboarding_join_code_uuid_fix.sql`. Essa migration troca o gerador do ID da empresa para `gen_random_uuid()`.

Em desenvolvimento, a UI mostra a mensagem real retornada pelo Supabase.
No terminal do servidor, procure logs com prefixo:

```text
[ONBOARDING]
```

## ID da empresa

O codigo publico e salvo em `organization_join_codes`.

Regras:

- e unico e gerado com bytes aleatorios;
- aparece como "ID da empresa" na interface;
- somente `owner` visualiza e copia;
- `admin` operacional nao visualiza;
- usuarios sem empresa podem usar o codigo para entrar.

## Recuperacao de senha

O fluxo usa Supabase Auth nativo:

1. Usuario informa e-mail e data de nascimento.
2. A API `/api/auth/request-password-reset` verifica `public.can_request_password_reset`.
3. A resposta da interface e sempre generica.
4. Se os dados forem validos, Supabase envia e-mail de reset.
5. O link abre `/reset-password`.
6. O usuario informa nova senha e confirmacao.

Mensagem generica:

```text
Se os dados estiverem corretos, enviaremos instrucoes para redefinir sua senha.
```

## URLs no Supabase Auth

Configure em Authentication -> URL Configuration:

Site URL de desenvolvimento:

```text
http://localhost:3000
```

Redirect URLs:

```text
http://localhost:3000/**
https://SEU-PROJETO.vercel.app/**
https://SEU-DOMINIO.com.br/**
```

Depois que o dominio final estiver ativo, troque o Site URL para:

```text
https://SEU-DOMINIO.com.br
```

## Rotas

- `/login`: login, cadastro e esqueci senha.
- `/reset-password`: troca senha com sessao de recovery.
- `/onboarding`: participar ou cadastrar empresa.
- `/minha-conta`: dados pessoais e plano.
- `/minha-empresa`: dados da empresa; somente owner edita.

## Seguranca

- Nenhuma `service_role key` e usada no frontend.
- O codigo da empresa nao e sequencial.
- Usuario sem empresa nao acessa dados operacionais.
- Usuario de uma empresa nao ve dados de outra empresa.
- `admin` operacional usa modulos operacionais, mas nao edita Minha Empresa nem ve o codigo da empresa.
