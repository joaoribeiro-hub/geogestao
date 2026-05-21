export type CheckoutSessionInput = {
  organizationId: string;
  planId: string;
  billingInterval: "monthly" | "quarterly" | "yearly";
};

export async function createCheckoutSession(input: CheckoutSessionInput) {
  void input;
  return {
    available: false,
    checkoutUrl: null,
    message: "Pagamento real ainda nao esta ativo nesta fase.",
  };
}

export async function handlePaymentWebhook(payload: unknown) {
  void payload;
  return {
    handled: false,
    message: "Webhook de pagamento reservado para fase futura.",
  };
}
