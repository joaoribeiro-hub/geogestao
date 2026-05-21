# GeoGestao - Planos e Billing Futuro

## Estado atual

A fase `AUTH-ORG-PLANS-1` prepara a base de planos, mas nao integra pagamento real.

Plano real ativo nesta fase:

## Plano Iniciante

- mensalidade: R$ 0,00 nesta fase;
- 1 owner;
- ate 2 admins operacionais;
- limite total: 3 usuarios ativos por empresa;
- armazenamento inicial: 3072 MB;
- assistente IA conforme regra tecnica atual;
- sem cobranca automatica.

## Tabelas

`plans`

- catalogo de planos;
- preco mensal em centavos;
- limite de armazenamento;
- limite de usuarios;
- recursos em `features`.

`organization_subscriptions`

- vincula empresa ao plano;
- guarda status e periodo corrente;
- preparada para provedor futuro.

`billing_orders`

- preparada para checkout futuro;
- nao cria cobranca nesta fase.

## Stubs futuros

`src/lib/billing.ts` contem:

- `createCheckoutSession(...)`;
- `handlePaymentWebhook(...)`.

Essas funcoes existem apenas para orientar a integracao futura.
Elas nao cobram, nao mudam plano e nao devem ser tratadas como gateway real.

## Regra futura planejada

Quando houver gateway:

- o plano muda apenas apos webhook confirmar pagamento;
- o recibo deve ir para o e-mail do owner;
- a assinatura pode ter validade mensal, trimestral ou anual;
- ao expirar, a empresa volta ao Iniciante;
- se exceder limites do Iniciante, o app pode permitir leitura e bloquear novas acoes de crescimento.

## Limites ja preparados

Helpers em `src/lib/services/organization-plans.ts`:

- `getOrganizationPlanLimits`;
- `canJoinOrganization`;
- `canUploadFile`;
- `canCreateService`;
- `canUseAssistant`;
- `summarizePlanUsage`.

Nesta fase, o bloqueio real aplicado e o limite de usuarios ao entrar por codigo.
Bloqueios de armazenamento, servicos, documentos e IA ficam preparados para fase futura.
