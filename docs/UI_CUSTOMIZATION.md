# Customizacao visual

Fase `KANBAN-UX-THEME-SOPHIA-TIME-1`.

## Aparencia

A engrenagem global controla:

- tamanho de fonte por slider, de `60%` a `175%`, com `120%` como padrao real para novos usuarios;
- modo claro/escuro;
- paletas: Agrimensura Verde, Azul Tecnico, Cerrado Terra, Grafite Profissional e Noite Atlantica.

O tamanho de fonte usa a variavel CSS `--app-font-scale`. Nao ha `zoom`, `transform: scale` nem escala global de layout.

Valores antigos salvos como `grande`, `muito_grande` ou `maximo` sao tratados como legado e voltam para `120%` para evitar quebra de layout. Valores numericos sao limitados entre `0.6` e `1.75`.

## Sidebar

O menu lateral pode ser recolhido no desktop. A preferencia fica no `localStorage` do usuario em `geogestao:sidebar-collapsed` e aplica `data-sidebar-collapsed` no elemento raiz. O conteudo principal expande quando a sidebar recolhe.

## Topo

O email solto e o antigo botao `Sair` foram substituidos por avatar circular com iniciais. O dropdown mostra Conta, nome, email, Minha conta e Fazer logout.

## Preparacao de banco

A migration `043_kanban_ux_theme_sophia_time.sql` cria:

- `user_ui_preferences`;
- `organization_page_visual_settings`;
- `assistant_feedback_examples`.

A migration `044_module_hub_external_apps.sql` cria `user_preferences`, que passa a ser a tabela canonica de preferencias visuais por usuario. A API `/api/ui-preferences` usa essa tabela e mantem fallback para `user_ui_preferences` enquanto a migration nova nao estiver aplicada.
