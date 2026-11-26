import { hmac, randomToken, safeEqual } from "../crypto";
import type { PaymentProvider } from "./types";

/**
 * Sandbox provider for development and demos. No real money moves. The hosted "checkout" page
 * (/pay/sandbox/[ref]) posts a webhook signed with APP_SECRET, exercising the same code path a real
 * provider would. It is disabled when NODE_ENV=production unless ALLOW_SANDBOX_PAYMENTS=1.
 */
export const sandboxProvider: PaymentProvider = {
  name: "sandbox",
  async createCheckout(req) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SANDBOX_PAYMENTS !== "1") {
      throw new Error("Sandbox payments are disabled in production. Configure PAYMENT_PROVIDER.");
    }
    const ref = `sbx_${randomToken(12)}`;
    return { providerRef: ref, url: `/pay/sandbox/${ref}?p=${req.paymentId}` };
  },
  async parseWebhook(raw, headers) {
    const sig = headers.get("x-sandbox-signature") ?? "";
    if (!safeEqual(hmac(`sandbox:${raw}`), sig)) throw new Error("Invalid signature");
    const evt = JSON.parse(raw) as { id: string; type: string; ref: string; amountFils?: number; reason?: string };
    if (evt.type === "payment.succeeded") return { kind: "succeeded", providerRef: evt.ref, eventId: evt.id };
    if (evt.type === "payment.failed") return { kind: "failed", providerRef: evt.ref, eventId: evt.id, reason: evt.reason ?? "Declined" };
    if (evt.type === "refund.succeeded") return { kind: "refunded", providerRef: evt.ref, eventId: evt.id, amountFils: evt.amountFils ?? 0 };
    return { kind: "ignored", eventId: evt.id };
  },
  async refund() {
    return { ok: true };
  },
};

export function signSandboxEvent(raw: string) {
  return hmac(`sandbox:${raw}`);
}
