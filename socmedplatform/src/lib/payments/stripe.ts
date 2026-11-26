import { createHmac } from "crypto";
import { safeEqual } from "../crypto";
import type { PaymentProvider } from "./types";

/**
 * Stripe Checkout adapter (REST, no SDK dependency). Stripe lists the UAE as a supported country, but
 * marketplace payout features (Connect account types, cross-border payouts) must be confirmed for your entity
 * before relying on split payouts. This adapter only collects payments to the platform account; creator payouts
 * are released and recorded by finance staff (see /admin/finance).
 */
const API = "https://api.stripe.com/v1";

async function stripe(path: string, body: Record<string, string>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Stripe error: ${(json.error as { message?: string })?.message ?? res.status}`);
  return json;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCheckout(req) {
    const s = await stripe("/checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": "aed",
      "line_items[0][price_data][unit_amount]": String(req.amountFils),
      "line_items[0][price_data][product_data][name]": req.description.slice(0, 200),
      "line_items[0][quantity]": "1",
      customer_email: req.customerEmail,
      client_reference_id: req.paymentId,
      "metadata[paymentId]": req.paymentId,
      "payment_intent_data[metadata][paymentId]": req.paymentId,
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
    });
    return { providerRef: String(s.id), url: String(s.url) };
  },
  async parseWebhook(raw, headers) {
    const header = headers.get("stripe-signature") ?? "";
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
    const expected = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET ?? "").update(`${parts.t}.${raw}`).digest("hex");
    if (!parts.t || !parts.v1 || !safeEqual(expected, parts.v1)) throw new Error("Invalid signature");
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) throw new Error("Stale webhook");
    const evt = JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, unknown> } };
    const obj = evt.data.object;
    if (evt.type === "checkout.session.completed" && obj.payment_status === "paid")
      return { kind: "succeeded", providerRef: String(obj.id), eventId: evt.id };
    if (evt.type === "checkout.session.async_payment_failed" || evt.type === "checkout.session.expired")
      return { kind: "failed", providerRef: String(obj.id), eventId: evt.id, reason: evt.type };
    if (evt.type === "charge.refunded") {
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      return { kind: "refunded", providerRef: "", paymentId: meta.paymentId, eventId: evt.id, amountFils: Number(obj.amount_refunded ?? 0) };
    }
    return { kind: "ignored", eventId: evt.id };
  },
  async refund(providerRef, amountFils) {
    try {
      const session = await fetch(`${API}/checkout/sessions/${providerRef}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }).then((r) => r.json());
      await stripe("/refunds", { payment_intent: String(session.payment_intent), amount: String(amountFils) });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  },
};
