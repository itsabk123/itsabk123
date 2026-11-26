import "server-only";
import { db } from "../db";
import { getConfig } from "../config";
import { calculateFees } from "../fees";
import { notifyProfile } from "../notify";
import { audit, track } from "../audit";
import type { WebhookOutcome } from "./types";

/**
 * Applies a verified provider event. Idempotent: each provider event id is stored once (unique constraint),
 * so replays are ignored. This is the ONLY place a payment becomes SUCCEEDED.
 */
export async function applyWebhook(provider: string, outcome: WebhookOutcome, payload: object) {
  try {
    await db.webhookEvent.create({ data: { provider, eventId: outcome.eventId, type: outcome.kind, payload } });
  } catch {
    return { duplicate: true };
  }
  if (outcome.kind === "ignored") return { ignored: true };

  const payment = outcome.paymentId
    ? await db.payment.findUnique({ where: { id: outcome.paymentId }, include: { deal: true } })
    : await db.payment.findUnique({ where: { providerRef: outcome.providerRef }, include: { deal: true } });
  if (!payment) return { unknown: true };
  await db.webhookEvent.update({ where: { provider_eventId: { provider, eventId: outcome.eventId } }, data: { paymentId: payment.id } });

  if (outcome.kind === "succeeded") {
    if (payment.status === "SUCCEEDED") return { ok: true };
    const [commission, vat] = await Promise.all([getConfig("commission"), getConfig("vat")]);
    const payeeId = payment.deal.initiatorProfileId === payment.payerProfileId ? payment.deal.recipientProfileId : payment.deal.initiatorProfileId;
    const payee = await db.profile.findUnique({ where: { id: payeeId }, select: { managedByOrgId: true } });
    const fees = calculateFees(payment.dealAmountFils, payment.deal.kind, { commission, vat }, { agencyManaged: !!payee?.managedByOrgId });
    const count = await db.invoice.count();
    const payer = await db.profile.findUnique({ where: { id: payment.payerProfileId }, select: { displayName: true } });
    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", confirmedAt: new Date(), commissionFils: fees.commissionFils, vatFils: fees.vatOnFeeFils } });
      await tx.payout.create({ data: { dealId: payment.dealId, payeeProfileId: payeeId, amountFils: fees.payeeNetFils, status: "HELD", holdReason: "Awaiting deliverable approval" } });
      await tx.invoice.create({
        data: {
          number: `MJ-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`,
          paymentId: payment.id,
          billedTo: payer?.displayName ?? "Customer",
          lines: [{ description: payment.deal.title, amountFils: payment.dealAmountFils }],
          subtotalFils: payment.dealAmountFils,
          vatFils: 0,
          totalFils: payment.amountFils,
        },
      });
      if (payment.deal.status === "CONTRACTED") {
        await tx.deal.update({ where: { id: payment.dealId }, data: { status: "FUNDED" } });
        await tx.dealEvent.create({ data: { dealId: payment.dealId, type: "status:FUNDED", detail: `Payment confirmed by ${provider}` } });
      }
    });
    await notifyProfile(payeeId, "payments", { title: "Payment received — you can start work", body: payment.deal.title, link: `/app/deals/${payment.dealId}` });
    await notifyProfile(payment.payerProfileId, "payments", { title: "Payment confirmed", body: payment.deal.title, link: `/app/deals/${payment.dealId}` });
    await track("deal_funded", null, { dealId: payment.dealId, amountFils: payment.amountFils });
    return { ok: true };
  }
  if (outcome.kind === "failed") {
    if (payment.status !== "PENDING") return { ok: true };
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: outcome.reason.slice(0, 200) } });
    await notifyProfile(payment.payerProfileId, "payments", { title: "Payment did not go through", body: "You can retry from the deal page.", link: `/app/deals/${payment.dealId}` });
    return { ok: true };
  }
  if (outcome.kind === "refunded") {
    const refunded = Math.min(payment.amountFils, payment.refundedFils + outcome.amountFils);
    await db.payment.update({ where: { id: payment.id }, data: { refundedFils: refunded, status: refunded >= payment.amountFils ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    await db.refund.updateMany({ where: { paymentId: payment.id, status: "APPROVED" }, data: { status: "PROCESSED", processedAt: new Date() } });
    await audit(null, "payment.refunded", { type: "Payment", id: payment.id }, { amountFils: outcome.amountFils });
    return { ok: true };
  }
  return { ok: true };
}
