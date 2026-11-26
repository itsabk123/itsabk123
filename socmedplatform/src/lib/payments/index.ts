import { sandboxProvider } from "./sandbox";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = { sandbox: sandboxProvider, stripe: stripeProvider };

export function paymentProvider(name = process.env.PAYMENT_PROVIDER ?? "sandbox"): PaymentProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown payment provider ${name}`);
  return p;
}
