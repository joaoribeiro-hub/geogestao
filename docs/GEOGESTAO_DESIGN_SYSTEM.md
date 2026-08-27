# Design system do GeoGestao

O GeoGestao combina a discrição operacional do Linear, a clareza e a acessibilidade de GOV.UK/NHS, a organização dos dashboards do Stripe e os estados consistentes do GitHub Primer.

## Regras de interface

- Espaço e hierarquia vêm antes de bordas e decoração.
- Cor reforça o significado, mas estados também usam texto ou ícone.
- Todo controle de teclado tem foco visível.
- Alvos de clique principais têm pelo menos 44px.
- Modais e menus podem ser fechados com Escape e têm rótulos acessíveis.
- Sidebar, cards e controles usam tokens CSS, para manter o layout previsível.
- A escala padrão de fonte é 120%; o ajuste de aparência altera texto, não zoom global.

## Perfis operacionais

O botão **Temas** representa o perfil operacional da organização, e não somente a paleta visual. O owner pode alternar entre Padrão, Agrimensura e Arquitetura. A escolha fica em `organizations.operational_profile`.

Agrimensura mantém os tipos e ferramentas técnicas atuais. Padrão e Arquitetura mostram somente itens universais até que a organização configure tipos personalizados.

## Fluxo de serviços

Owners podem abrir **Editar** em Serviços para criar tipos personalizados, reordenar tabs e editar etapas. Tipos personalizados recebem `organization_id`; os quatro boards históricos de Agrimensura permanecem globais para compatibilidade. Cards não são apagados ao desativar um tipo/etapa: se existirem cards, é necessário escolher ou informar um destino seguro.

## Command menu

`Ctrl+K` ou `Cmd+K` abre o menu de comandos. A primeira versão oferece atalhos para criar/abrir serviço, cliente, tarefa, Sophia e ferramentas. A lista foi feita como componente extensível para buscas reais futuras.
