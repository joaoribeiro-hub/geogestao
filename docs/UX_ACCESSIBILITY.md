# GeoGestao UI e acessibilidade

Esta fase organiza a interface sem alterar as regras de negocio.

## Aparencia

O tamanho padrao da fonte e `120%` (`--app-font-scale: 1.2`). O controle permite valores de `60%` a `175%` em passos de `5%`. Valores persistidos abaixo de `0.6`, vazios ou invalidos voltam para `120%`; valores acima de `1.75` ficam em `175%`.

A preferencia e salva em `user_preferences` por usuario. O legado `user_ui_preferences` continua sendo lido quando a tabela nova nao estiver disponivel.

## Modo leve

O botao `Modo leve` simplifica apenas a navegacao visual. O menu principal fica com Inicio, Ferramentas, Servicos e Agenda; Configuracoes continua disponivel. Rotas diretas continuam funcionando, pois o modo nao e uma permissao.

A preferencia usa `user_preferences.lightweight_mode`.

## Expediente

O timer e o heartbeat ficam desativados por padrao para evitar chamadas constantes enquanto o controle de expediente esta em revisao. Para reativar temporariamente no ambiente, defina `NEXT_PUBLIC_TIME_TRACKING_ENABLED=true`. As tabelas e endpoints nao foram removidos.

## Sophia e anexos

O chat da Sophia aceita um arquivo por envio. O arquivo passa pela validacao do Storage privado existente e aparece como chip antes do envio. PDF, DOCX e imagens ficam armazenados para processamento futuro; a leitura profunda/OCR nao faz parte desta fase.

## Navegacao e acessibilidade

Configuracoes ficam separadas na parte inferior flexivel da sidebar. Os itens possuem alvo minimo de aproximadamente 44px, foco visivel e rolagem quando a altura da tela for pequena. A Sophia recebe destaque visual maior que as demais acoes flutuantes.
