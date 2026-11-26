import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor } from "@/lib/access";
import { formatAed } from "@/lib/money";
import { sandboxProvider, signSandboxEvent } from "@/lib/payments/sandbox";
import { applyWebhook } from "@/lib/payments/process";
import { randomToken } from "@/lib/crypto";
import { ChoiceButton } from "@/components/choice-button";

export const metadata = { robots: { index: false } };

async function complete(fd: FormData) {
  "use server";
  const user = await requireUser();
  const ref = String(fd.get("ref"));
  const payment = await db.payment.findUnique({ where: { providerRef: ref } });
  if (!payment || payment.provider !== "sandbox" || !(await canActFor(user.id, payment.payerProfileId))) redirect("/app/finance?err=Not+authorised");
  const decision = fd.get("decision") === "fail" ? "payment.failed" : "payment.succeeded";
  // Build and sign the event exactly as a provider would, then run it through the same verification path as the webhook route.
  const raw = JSON.stringify({ id: `evt_${randomToken(10)}`, type: decision, ref, reason: "Card declined (sandbox)" });
  const headers = new Headers({ "x-sandbox-signature": signSandboxEvent(raw) });
  const outcome = await sandboxProvider.parseWebhook(raw, headers);
  await applyWebhook("sandbox", outcome, JSON.parse(raw));
  redirect(`/app/deals/${payment.dealId}?${decision === "payment.succeeded" ? "ok=Sandbox+payment+confirmed" : "err=Sandbox+payment+declined"}`);
}

export default async function SandboxCheckout({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await requireUser();
  const payment = await db.payment.findUnique({ where: { providerRef: ref }, include: { deal: true } });
  if (!payment || payment.provider !== "sandbox") notFound();
  if (!(await canActFor(user.id, payment.payerProfileId))) notFound();
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-pad space-y-4">
        <div className="badge-warn">Sandbox checkout — no real money moves</div>
        <h1 className="h2">{formatAed(payment.amountFils)}</h1>
        <p className="text-sm text-muted">{payment.deal.title}</p>
        {payment.status !== "PENDING" ? <p className="text-sm">This payment is {payment.status.toLowerCase()}.</p> : (
          <form action={complete} className="flex gap-2">
            <input type="hidden" name="ref" value={ref} />
            <ChoiceButton name="decision" value="succeed" className="btn-primary flex-1">Simulate successful payment</ChoiceButton>
            <ChoiceButton name="decision" value="fail" className="btn-secondary">Simulate decline</ChoiceButton>
          </form>
        )}
        <p className="text-xs text-muted">In production this page is replaced by the configured provider's hosted checkout (e.g. Stripe). The payment is marked as paid only after a signed provider event is verified.</p>
      </div>
    </div>
  );
}
