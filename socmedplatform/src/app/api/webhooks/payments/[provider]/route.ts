import { NextResponse } from "next/server";
import { paymentProvider } from "@/lib/payments";
import { applyWebhook } from "@/lib/payments/process";

/** Provider webhooks. Signature is verified before anything is read; events are idempotent by provider event id. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  let p;
  try { p = paymentProvider(provider); } catch { return NextResponse.json({ error: "unknown provider" }, { status: 404 }); }
  const raw = await req.text();
  let outcome;
  try {
    outcome = await p.parseWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const result = await applyWebhook(p.name, outcome, JSON.parse(raw));
  return NextResponse.json({ received: true, ...result });
}
