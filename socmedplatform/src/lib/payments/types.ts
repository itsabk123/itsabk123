export type CheckoutRequest = {
  paymentId: string;
  amountFils: number;
  currency: "AED";
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type WebhookOutcome =
  | { kind: "succeeded"; providerRef: string; eventId: string; paymentId?: string }
  | { kind: "failed"; providerRef: string; eventId: string; reason: string; paymentId?: string }
  | { kind: "refunded"; providerRef: string; eventId: string; amountFils: number; paymentId?: string }
  | { kind: "ignored"; eventId: string };

export interface PaymentProvider {
  name: string;
  /** Creates a hosted checkout. The payment is NOT marked paid here — only a verified webhook does that. */
  createCheckout(req: CheckoutRequest): Promise<{ providerRef: string; url: string }>;
  /** Verifies signature and parses the event. Throws on invalid signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookOutcome>;
  refund(providerRef: string, amountFils: number): Promise<{ ok: boolean; reason?: string }>;
}
