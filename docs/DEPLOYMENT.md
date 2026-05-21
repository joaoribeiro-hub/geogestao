# GeoGestao - Deploy

## Fluxo recomendado

1. Alterar codigo no Codex.
2. Se houver migration nova, aplicar primeiro no Supabase de teste.
3. Testar localmente.
4. Rodar:

```bash
npm run typecheck
npm run build
npm run test
```

5. Conferir `git status`.
6. Fazer `git add`, `git commit` e `git push`.
7. Aguardar GitHub Actions ficar verde.
8. Aplicar a mesma migration no Supabase oficial.
9. A Vercel faz deploy automatico ao receber push na branch principal, ou pode ser usado Redeploy manual.
10. Testar o app publicado.

## Ordem migration x deploy

Quando o codigo novo depende de colunas, funcoes ou policies novas, aplique a migration no Supabase oficial antes de validar o deploy final publicado. Isso evita erro temporario por coluna inexistente no app em producao.

## Cuidados

- Nunca commitar `.env.local`.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Rodar E2E destrutivo apenas no workflow manual e somente contra Supabase de teste.
- Nao aplicar migrations diretamente em producao antes de validar no Supabase de teste.
