# Preferencias do Usuario

Fase: `MODULE-HUB-EXTERNAL-APPS-1`.

## Objetivo

Preferencias visuais passam a ser salvas por usuario no banco, permitindo carregar a mesma aparencia em outro computador.

## Tabela

Migration: `044_module_hub_external_apps.sql`.

Tabela: `user_preferences`.

Campos principais:

- `user_id`;
- `font_scale`, default `1.2`;
- `theme_mode`, default `light`;
- `palette_key`, default `agrimensura_verde`;
- `background_settings`, default `{}`.

## Fonte

O tamanho padrao real do app agora e `120%` (`font_scale = 1.2`) para usuarios sem preferencia salva.

A escala continua usando `--app-font-scale`; nao usa `zoom`, `document.body.style.zoom` nem `transform: scale`.

Valores antigos salvos em `user_ui_preferences` ou `localStorage` sao normalizados para a faixa `0.6` a `1.75`.

## API

Endpoint:

- `GET /api/ui-preferences`;
- `PATCH /api/ui-preferences`.

O endpoint tenta usar `user_preferences`. Enquanto a migration nova nao estiver aplicada, ele usa `user_ui_preferences` como fallback para nao quebrar a interface.

## Relacao com o Hub de Modulos

Na fase `MODULE-HUB-REAL-PORT-1`, o seletor de modulos continua usando as mesmas preferencias visuais carregadas por usuario. O tamanho padrao de fonte permanece `font_scale = 1.2`, e as telas portadas de RTK/PPP, RW5 e BuscaGEO devem respeitar a escala global sem criar zoom proprio.

## RLS

O usuario so pode ler e alterar a propria preferencia:

```sql
user_id = auth.uid()
```

## Teste manual

1. Abrir o app autenticado.
2. Abrir Aparencia pela engrenagem.
3. Alterar fonte, tema ou paleta.
4. Recarregar a pagina e confirmar que a preferencia foi mantida.
5. Entrar em outro navegador/computador com o mesmo usuario e confirmar que a preferencia foi carregada do banco.
