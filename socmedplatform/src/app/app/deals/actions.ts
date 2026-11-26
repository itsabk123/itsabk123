"use server";
import { redirect } from "next/navigation";
import type { DealKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor, getActingContext } from "@/lib/access";
import { date, int, optStr, str, url } from "@/lib/forms";
import { parseAedToFils } from "@/lib/money";
import { createDeal, notifyCounterparty, proposalData, transitionDeal, type ProposalInput } from "@/lib/deals";
import { getConfig } from "@/lib/config";
import { calculateFees } from "@/lib/fees";
import { renderContract } from "@/lib/contract";
import { paymentProvider } from "@/lib/payments";
import { approverProfileId, defaultPayer, otherParty, payeeProfileId } from "@/lib/deal-roles";
import { OFFERING_KINDS } from "@/lib/taxonomy";
import { generateSlots } from "@/lib/time";
import { audit, track } from "@/lib/audit";
import { notifyProfile } from "@/lib/notify";
import { randomToken } from "@/lib/crypto";

const fail = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
const ok = (path: string, msg: string): never => redirect(`${path}?ok=${encodeURIComponent(msg)}`);

function parseDeliverables(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((l) => {
      const m = l.match(/^(.*?)(?:\s*[—|-]\s*(\d{4}-\d{2}-\d{2}))?$/);
      return { title: (m?.[1] ?? l).slice(0, 200), dueDate: m?.[2] ?? null };
    });
}

/** Loads a deal and the acting party (a profile in the deal the user can act for). */
async function loadParty(dealId: string) {
  const user = await requireUser();
  const deal = await db.deal.findUnique({ where: { id: dealId }, include: { initiator: true, recipient: true, proposals: { orderBy: { createdAt: "desc" } }, contract: true, deliverables: true, disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } } });
  if (!deal) redirect("/app/deals?err=Deal+not+found");
  const ctx = await getActingContext();
  let me: string | null = null;
  if (ctx?.acting && [deal.initiatorProfileId, deal.recipientProfileId].includes(ctx.acting.id)) me = ctx.acting.id;
  else if (await canActFor(user.id, deal.initiatorProfileId)) me = deal.initiatorProfileId;
  else if (await canActFor(user.id, deal.recipientProfileId)) me = deal.recipientProfileId;
  if (!me) redirect("/app/deals?err=Not+authorised");
  const agreed = deal.agreedProposalId ? deal.proposals.find((p) => p.id === deal.agreedProposalId) ?? null : null;
  return { user, deal, me, agreed, path: `/app/deals/${deal.id}` };
}

async function checkMonthlyLimit(profileId: string, origin: "INVITATION" | "APPLICATION" | "PITCH" | "PACKAGE_REQUEST", userId: string) {
  const sub = await db.subscription.findFirst({ where: { userId, status: "ACTIVE", plan: { priceMonthlyFils: { gt: 0 } } } });
  if (sub) return;
  const free = await getConfig("freeTier");
  const limit = origin === "APPLICATION" || origin === "PITCH" ? free.monthlyApplications : free.monthlyInvites;
  const used = await db.deal.count({ where: { initiatorProfileId: profileId, origin, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } });
  if (used >= limit) fail("/app/deals", `Free plan limit reached (${limit} per 30 days). Upgrade for more.`);
}

export async function createDealFromForm(fd: FormData) {
  const user = await requireUser();
  const ctx = await getActingContext();
  if (!ctx?.acting) redirect("/app/onboarding");
  const me = ctx.acting;
  const back = `/app/deals/new?${new URLSearchParams({ to: str(fd, "to"), campaign: str(fd, "campaign"), offering: str(fd, "offering") })}`;
  if (!user.emailVerifiedAt) fail(back, "Confirm your email address before sending proposals.");

  const campaign = str(fd, "campaign") ? await db.campaign.findUnique({ where: { id: str(fd, "campaign") } }) : null;
  const offering = str(fd, "offering") ? await db.offering.findUnique({ where: { id: str(fd, "offering") } }) : null;
  const toId = campaign ? campaign.brandProfileId : offering ? offering.profileId : str(fd, "to");
  const to = await db.profile.findUnique({ where: { id: toId } });
  if (!to || to.status !== "PUBLISHED") fail(back, "That profile isn't available.");
  if (campaign && (campaign.status !== "OPEN" || !campaign.creatorTypes.includes(me.type))) fail(back, "This campaign isn't accepting proposals from this profile type.");
  if (offering && (!offering.isActive || (offering.inventoryTotal !== null && offering.inventoryUsed >= offering.inventoryTotal))) fail(back, "That package is no longer available.");

  const creatorSide = ["PODCAST", "INFLUENCER", "GUEST"].includes(me.type);
  if (creatorSide && me.status !== "PUBLISHED") fail(back, "Publish your profile first — partners want to see who you are.");

  const origin = campaign ? "APPLICATION" : offering ? "PACKAGE_REQUEST" : me.type === "GUEST" && to!.type === "PODCAST" ? "PITCH" : "INVITATION";
  await checkMonthlyLimit(me.id, origin, user.id);

  const kind: DealKind = offering ? (OFFERING_KINDS[offering.kind]?.deal as DealKind) ?? "OTHER"
    : (str(fd, "kind") as DealKind) || (me.type === "GUEST" || to!.type === "GUEST" ? "GUEST_APPEARANCE" : me.type === "PODCAST" || to!.type === "PODCAST" ? "PODCAST_SPONSORSHIP" : "INFLUENCER_CAMPAIGN");
  const priceFils = parseAedToFils(fd.get("price")) ?? 0;
  const commission = await getConfig("commission");
  if (priceFils > 0 && priceFils < commission.minimumDealFils) fail(back, `Paid deals must be at least AED ${commission.minimumDealFils / 100}.`);
  const payerChoice = str(fd, "payer");
  const payer = payerChoice === "me" ? me.id : payerChoice === "them" ? to!.id : defaultPayer(me, to!, false);
  const deliverables = parseDeliverables(str(fd, "deliverables", 4000));
  if (!deliverables.length) fail(back, "List at least one deliverable.");

  let deal;
  try {
    deal = await createDeal({
      origin,
      kind,
      title: str(fd, "title", 160) || campaign?.name || offering?.title || `${me.displayName} × ${to!.displayName}`,
      initiatorProfileId: me.id,
      recipientProfileId: to!.id,
      campaignId: campaign?.id,
      offeringId: offering?.id,
      matchScore: int(fd, "matchScore"),
      proposal: {
        priceFils,
        payerProfileId: priceFils > 0 ? payer : null,
        deliverables,
        publishDate: date(fd, "publishDate"),
        usageRights: optStr(fd, "usageRights", 1000),
        exclusivity: optStr(fd, "exclusivity", 500),
        revisions: int(fd, "revisions") ?? 1,
        message: optStr(fd, "message", 3000),
      },
      actorUserId: user.id,
    });
  } catch (e) {
    fail(back, (e as Error).message);
  }

  // Optional time slot for bookable services.
  const slot = str(fd, "slot");
  if (slot && offering?.bookable) {
    const startsAt = new Date(slot);
    const rules = await db.availabilityRule.findMany({ where: { profileId: offering.profileId } });
    const busy = await db.booking.findMany({ where: { providerProfileId: offering.profileId, status: { in: ["REQUESTED", "CONFIRMED"] }, endsAt: { gte: new Date() } } });
    const valid = generateSlots(rules, busy, { durationMin: offering.durationMin ?? 60, days: 30 }).some((s) => s.startsAt.getTime() === startsAt.getTime());
    if (valid) {
      await db.booking.create({
        data: {
          dealId: deal!.id, offeringId: offering.id, providerProfileId: offering.profileId, requesterProfileId: me.id, startsAt,
          endsAt: new Date(startsAt.getTime() + (offering.durationMin ?? 60) * 60000), mode: str(fd, "mode") === "IN_PERSON" ? "IN_PERSON" : "VIRTUAL", notes: optStr(fd, "message", 1000),
        },
      });
    }
  }
  redirect(`/app/deals/${deal!.id}?ok=${encodeURIComponent("Proposal sent")}`);
}

export async function counterProposal(fd: FormData) {
  const { user, deal, me, path } = await loadParty(str(fd, "dealId"));
  if (!["PROPOSED", "NEGOTIATING"].includes(deal.status)) fail(path, "This deal is no longer open for negotiation.");
  const priceFils = parseAedToFils(fd.get("price")) ?? 0;
  const commission = await getConfig("commission");
  if (priceFils > 0 && priceFils < commission.minimumDealFils) fail(path, `Paid deals must be at least AED ${commission.minimumDealFils / 100}.`);
  const current = deal.proposals.find((p) => p.status === "ACTIVE");
  const payerChoice = str(fd, "payer");
  const payer = payerChoice === "me" ? me : payerChoice === "them" ? otherParty(deal, me) : current?.payerProfileId ?? defaultPayer(deal.initiator, deal.recipient);
  const p: ProposalInput = {
    priceFils,
    payerProfileId: payer,
    deliverables: parseDeliverables(str(fd, "deliverables", 4000)),
    publishDate: date(fd, "publishDate"),
    usageRights: optStr(fd, "usageRights", 1000),
    exclusivity: optStr(fd, "exclusivity", 500),
    revisions: int(fd, "revisions") ?? 1,
    message: optStr(fd, "message", 2000),
  };
  if (!p.deliverables.length) fail(path, "List at least one deliverable.");
  await db.$transaction([
    db.proposal.updateMany({ where: { dealId: deal.id, status: "ACTIVE" }, data: { status: "SUPERSEDED" } }),
    db.proposal.create({ data: proposalData(deal.id, me, p) }),
  ]);
  if (deal.status === "PROPOSED") await transitionDeal(deal.id, "NEGOTIATING", user.id, "counter-offer");
  else await db.dealEvent.create({ data: { dealId: deal.id, actorUserId: user.id, type: "counter-offer" } });
  await notifyCounterparty(deal, me, "New counter-offer", deal.title);
  ok(path, "Counter-offer sent");
}

export async function acceptProposal(fd: FormData) {
  const { user, deal, me, path } = await loadParty(str(fd, "dealId"));
  const active = deal.proposals.find((p) => p.status === "ACTIVE");
  if (!active || !["PROPOSED", "NEGOTIATING"].includes(deal.status)) fail(path, "Nothing to accept.");
  if (active!.authorProfileId === me) fail(path, "Wait for the other party to respond to your proposal.");
  const [commission, vat] = await Promise.all([getConfig("commission"), getConfig("vat")]);
  const fees = calculateFees(active!.priceFils, deal.kind, { commission, vat });
  const payer = active!.payerProfileId ? (active!.payerProfileId === deal.initiatorProfileId ? deal.initiator : deal.recipient) : null;
  const contract = renderContract({
    dealId: deal.id,
    title: deal.title,
    initiator: { name: deal.initiator.displayName, slug: deal.initiator.slug },
    recipient: { name: deal.recipient.displayName, slug: deal.recipient.slug },
    payer: payer ? { name: payer.displayName, slug: payer.slug } : null,
    priceFils: active!.priceFils,
    deliverables: active!.deliverables as { title: string; dueDate?: string | null }[],
    publishDate: active!.publishDate,
    usageRights: active!.usageRights,
    exclusivity: active!.exclusivity,
    revisions: active!.revisions,
    commissionPct: fees.commissionPct,
  });
  await db.$transaction(async (tx) => {
    await tx.proposal.update({ where: { id: active!.id }, data: { status: "ACCEPTED" } });
    await tx.deal.update({ where: { id: deal.id, status: deal.status }, data: { status: "AGREED", agreedProposalId: active!.id } });
    await tx.dealEvent.create({ data: { dealId: deal.id, actorUserId: user.id, type: "status:AGREED" } });
    await tx.deliverable.deleteMany({ where: { dealId: deal.id } });
    await tx.deliverable.createMany({ data: (active!.deliverables as { title: string; dueDate?: string | null }[]).map((d) => ({ dealId: deal.id, title: d.title, dueDate: d.dueDate ? new Date(d.dueDate) : null })) });
    await tx.contract.upsert({
      where: { dealId: deal.id },
      create: { dealId: deal.id, body: contract.body, bodyHash: contract.hash, templateVersion: contract.version },
      update: { body: contract.body, bodyHash: contract.hash, templateVersion: contract.version, initiatorAcceptedAt: null, recipientAcceptedAt: null, initiatorAcceptedBy: null, recipientAcceptedBy: null },
    });
    for (const [o, c] of [[deal.initiatorProfileId, deal.recipientProfileId], [deal.recipientProfileId, deal.initiatorProfileId]])
      await tx.crmContact.updateMany({ where: { ownerProfileId: o, contactProfileId: c }, data: { stage: "NEGOTIATING" } });
  });
  await notifyCounterparty(deal, me, "Terms accepted — review and sign the agreement", deal.title);
  await track("proposal_accepted", user.id, { kind: deal.kind });
  ok(path, "Terms agreed. Review and sign the agreement below.");
}

export async function signContract(fd: FormData) {
  const { user, deal, me, agreed, path } = await loadParty(str(fd, "dealId"));
  if (deal.status !== "AGREED" || !deal.contract) fail(path, "There's no agreement waiting for signature.");
  if (str(fd, "hash") !== deal.contract!.bodyHash) fail(path, "The agreement changed since you opened it. Please review again.");
  if (str(fd, "confirm") !== "on") fail(path, "Tick the box to confirm you accept the agreement.");
  const side = me === deal.initiatorProfileId ? "initiator" : "recipient";
  const data: Prisma.ContractUpdateInput = side === "initiator" ? { initiatorAcceptedAt: new Date(), initiatorAcceptedBy: user.id } : { recipientAcceptedAt: new Date(), recipientAcceptedBy: user.id };
  const c = await db.contract.update({ where: { dealId: deal.id }, data });
  await audit(user.id, "contract.accept", { type: "Deal", id: deal.id }, { hash: c.bodyHash, side });
  if (c.initiatorAcceptedAt && c.recipientAcceptedAt) {
    // Reserve inventory atomically so a package can never be oversold.
    if (deal.offeringId) {
      const off = await db.offering.findUniqueOrThrow({ where: { id: deal.offeringId } });
      if (off.inventoryTotal !== null) {
        const res = await db.offering.updateMany({ where: { id: off.id, inventoryUsed: { lt: off.inventoryTotal } }, data: { inventoryUsed: { increment: 1 } } });
        if (res.count === 0) {
          await transitionDeal(deal.id, "CANCELLED", user.id, "inventory exhausted", { cancelledReason: "Package sold out before both parties signed" });
          fail(path, "Sorry — this package sold out before the agreement was completed. The deal was cancelled.");
        }
      }
    }
    const paid = (agreed?.priceFils ?? 0) > 0;
    await transitionDeal(deal.id, "CONTRACTED", user.id);
    if (!paid) await transitionDeal(deal.id, "IN_PROGRESS", user.id, "no payment required");
    await db.booking.updateMany({ where: { dealId: deal.id, status: "REQUESTED" }, data: { status: "CONFIRMED" } });
    for (const [o, ct] of [[deal.initiatorProfileId, deal.recipientProfileId], [deal.recipientProfileId, deal.initiatorProfileId]])
      await db.crmContact.updateMany({ where: { ownerProfileId: o, contactProfileId: ct }, data: { stage: "BOOKED" } });
    await notifyCounterparty(deal, me, paid ? "Agreement signed — awaiting payment" : "Agreement signed — collaboration is on", deal.title);
    ok(path, paid ? "Agreement signed by both parties. Payment is next." : "Agreement signed. You're ready to go.");
  }
  await notifyCounterparty(deal, me, "Your partner signed the agreement", deal.title);
  ok(path, "Signed. Waiting for the other party.");
}

export async function startPayment(fd: FormData) {
  const { user, deal, me, agreed, path } = await loadParty(str(fd, "dealId"));
  if (deal.status !== "CONTRACTED" || !agreed?.payerProfileId) fail(path, "This deal isn't awaiting payment.");
  if (agreed!.payerProfileId !== me) fail(path, "Only the paying party can pay.");
  if (!user.emailVerifiedAt) fail(path, "Confirm your email address before paying.");
  const pending = await db.payment.findFirst({ where: { dealId: deal.id, status: "PENDING" } });
  if (pending?.checkoutUrl && pending.createdAt.getTime() > Date.now() - 30 * 60_000) redirect(pending.checkoutUrl);
  const provider = paymentProvider();
  const payment = await db.payment.create({
    data: { dealId: deal.id, payerProfileId: me, amountFils: agreed!.priceFils, dealAmountFils: agreed!.priceFils, commissionFils: 0, provider: provider.name },
  });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id, amountFils: payment.amountFils, currency: "AED", description: deal.title, customerEmail: user.email,
      successUrl: `${base}${path}?ok=${encodeURIComponent("Thanks — we'll confirm as soon as the payment provider does.")}`, cancelUrl: `${base}${path}?err=Payment+cancelled`,
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: session.providerRef, checkoutUrl: session.url } });
    await audit(user.id, "payment.checkout_created", { type: "Payment", id: payment.id }, { provider: provider.name });
    redirect(session.url);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: (e as Error).message.slice(0, 200) } });
    fail(path, `Couldn't start payment: ${(e as Error).message}`);
  }
}

export async function startWork(fd: FormData) {
  const { user, deal, me, agreed, path } = await loadParty(str(fd, "dealId"));
  if (deal.status !== "FUNDED") fail(path, "Work can start once payment is confirmed.");
  if (payeeProfileId(deal, agreed) !== me) fail(path, "Only the creator marks work as started.");
  await transitionDeal(deal.id, "IN_PROGRESS", user.id);
  await notifyCounterparty(deal, me, "Work has started", deal.title);
  ok(path, "Marked as in progress");
}

export async function submitDeliverable(fd: FormData) {
  const { user, deal, me, agreed, path } = await loadParty(str(fd, "dealId"));
  if (!["IN_PROGRESS", "DELIVERED"].includes(deal.status)) fail(path, "Deliverables can be submitted while the deal is in progress.");
  if (approverProfileId(deal, agreed) === me) fail(path, "The other party submits deliverables.");
  const d = deal.deliverables.find((x) => x.id === str(fd, "deliverableId"));
  if (!d || d.status === "APPROVED") fail(path, "Deliverable not found.");
  await db.deliverable.update({ where: { id: d!.id }, data: { status: "SUBMITTED", submissionUrl: url(fd, "submissionUrl"), notes: optStr(fd, "notes", 2000), submittedAt: new Date() } });
  const remaining = await db.deliverable.count({ where: { dealId: deal.id, status: { in: ["PENDING", "REVISION_REQUESTED"] } } });
  if (remaining === 0 && deal.status === "IN_PROGRESS") await transitionDeal(deal.id, "DELIVERED", user.id);
  await notifyCounterparty(deal, me, "Deliverable submitted for approval", d!.title);
  ok(path, "Submitted for approval");
}

export async function reviewDeliverable(fd: FormData) {
  const { user, deal, me, agreed, path } = await loadParty(str(fd, "dealId"));
  if (approverProfileId(deal, agreed) !== me) fail(path, "Only the approving party can review deliverables.");
  if (deal.disputes.length) fail(path, "This deal is in dispute. Our team will resolve it.");
  const d = deal.deliverables.find((x) => x.id === str(fd, "deliverableId"));
  if (!d || d.status !== "SUBMITTED") fail(path, "Nothing to review.");
  const decision = str(fd, "decision");
  if (decision === "revise") {
    const used = await db.dealEvent.count({ where: { dealId: deal.id, type: "revision_requested" } });
    if (used >= (agreed?.revisions ?? 1) * Math.max(1, deal.deliverables.length)) fail(path, "All agreed revision rounds have been used. Approve, or open a dispute.");
    await db.deliverable.update({ where: { id: d!.id }, data: { status: "REVISION_REQUESTED", feedback: optStr(fd, "feedback", 2000) } });
    await db.dealEvent.create({ data: { dealId: deal.id, actorUserId: user.id, type: "revision_requested", detail: d!.title } });
    if (deal.status === "DELIVERED") await transitionDeal(deal.id, "IN_PROGRESS", user.id, "revision requested");
    await notifyCounterparty(deal, me, "Revision requested", d!.title);
    ok(path, "Revision requested");
  }
  await db.deliverable.update({ where: { id: d!.id }, data: { status: "APPROVED", approvedAt: new Date(), feedback: optStr(fd, "feedback", 2000) } });
  const left = await db.deliverable.count({ where: { dealId: deal.id, status: { not: "APPROVED" } } });
  if (left === 0) {
    await completeDeal(deal.id, user.id);
    await notifyCounterparty(deal, me, "All deliverables approved — collaboration complete", deal.title);
    ok(path, "Approved. The collaboration is complete — please leave a review.");
  }
  await notifyCounterparty(deal, me, "Deliverable approved", d!.title);
  ok(path, "Approved");
}

async function completeDeal(dealId: string, actorUserId: string) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (deal.status === "IN_PROGRESS") await transitionDeal(dealId, "DELIVERED", actorUserId);
  await transitionDeal(dealId, "COMPLETED", actorUserId, undefined, { completedAt: new Date() });
  // Payout becomes eligible only on completion with no open dispute — never earlier.
  await db.payout.updateMany({ where: { dealId, status: "HELD" }, data: { status: "ELIGIBLE", holdReason: null } });
  for (const [o, c] of [[deal.initiatorProfileId, deal.recipientProfileId], [deal.recipientProfileId, deal.initiatorProfileId]]) {
    const prior = await db.deal.count({ where: { status: "COMPLETED", id: { not: dealId }, OR: [{ initiatorProfileId: o, recipientProfileId: c }, { initiatorProfileId: c, recipientProfileId: o }] } });
    await db.crmContact.updateMany({ where: { ownerProfileId: o, contactProfileId: c }, data: { stage: prior > 0 ? "REPEAT_CLIENT" : "COMPLETED" } });
  }
  // A referral qualifies on the referee's first completed collaboration (rewards value, not sign-ups).
  const owners = await db.profile.findMany({ where: { id: { in: [deal.initiatorProfileId, deal.recipientProfileId] } }, select: { ownerUserId: true } });
  await db.referral.updateMany({ where: { refereeUserId: { in: owners.map((o) => o.ownerUserId) }, qualifiedAt: null }, data: { qualifiedAt: new Date() } });
  if (deal.campaignId) {
    const open = await db.deal.count({ where: { campaignId: deal.campaignId, status: { notIn: ["COMPLETED", "DECLINED", "CANCELLED"] } } });
    if (open === 0) await db.campaign.updateMany({ where: { id: deal.campaignId, status: "IN_PROGRESS" }, data: { status: "COMPLETED" } });
  }
  await track("deal_completed", actorUserId, { dealId, kind: deal.kind });
}

export async function declineDeal(fd: FormData) {
  const { user, deal, me, path } = await loadParty(str(fd, "dealId"));
  if (!["PROPOSED", "NEGOTIATING"].includes(deal.status)) fail(path, "This deal can't be declined now.");
  await transitionDeal(deal.id, "DECLINED", user.id, optStr(fd, "reason", 500) ?? undefined);
  await db.crmContact.updateMany({ where: { ownerProfileId: me, contactProfileId: otherParty(deal, me) }, data: { stage: "NOT_INTERESTED" } });
  await notifyCounterparty(deal, me, "Proposal declined", deal.title);
  ok(path, "Declined");
}

export async function cancelDeal(fd: FormData) {
  const { user, deal, me, agreed, path } = await loadParty(str(fd, "dealId"));
  const reason = optStr(fd, "reason", 500) ?? "Cancelled by party";
  if (["PROPOSED", "NEGOTIATING", "AGREED", "CONTRACTED"].includes(deal.status)) {
    await db.payment.updateMany({ where: { dealId: deal.id, status: "PENDING" }, data: { status: "FAILED", failureReason: "Deal cancelled" } });
    await transitionDeal(deal.id, "CANCELLED", user.id, reason, { cancelledReason: reason });
    await db.booking.updateMany({ where: { dealId: deal.id, status: { in: ["REQUESTED", "CONFIRMED"] } }, data: { status: "CANCELLED" } });
    await notifyCounterparty(deal, me, "Deal cancelled", deal.title);
    ok(path, "Deal cancelled");
  }
  if (deal.status === "FUNDED") {
    // Before work starts: full refund to the payer.
    const payment = await db.payment.findFirst({ where: { dealId: deal.id, status: "SUCCEEDED" } });
    if (payment) {
      await db.refund.create({ data: { paymentId: payment.id, amountFils: payment.amountFils - payment.refundedFils, reason: `Cancelled before work started: ${reason}`, status: "APPROVED" } });
      const r = await paymentProvider(payment.provider).refund(payment.providerRef ?? "", payment.amountFils - payment.refundedFils);
      await audit(user.id, "refund.requested", { type: "Payment", id: payment.id }, { ok: r.ok });
    }
    await db.payout.updateMany({ where: { dealId: deal.id }, data: { status: "CANCELLED" } });
    await transitionDeal(deal.id, "CANCELLED", user.id, reason, { cancelledReason: reason });
    if (deal.offeringId && agreed) await db.offering.updateMany({ where: { id: deal.offeringId, inventoryUsed: { gt: 0 } }, data: { inventoryUsed: { decrement: 1 } } });
    await notifyCounterparty(deal, me, "Deal cancelled before work started — refund issued", deal.title);
    ok(path, "Cancelled. The payer will be refunded once the payment provider confirms.");
  }
  fail(path, "Work has started. To stop this deal, open a dispute so we can review fairly.");
}

export async function openDispute(fd: FormData) {
  const { user, deal, me, path } = await loadParty(str(fd, "dealId"));
  if (!["FUNDED", "IN_PROGRESS", "DELIVERED"].includes(deal.status)) fail(path, "Disputes can be opened on funded or in-progress deals.");
  const reason = str(fd, "reason", 120);
  const details = str(fd, "details", 4000);
  if (!reason || details.length < 20) fail(path, "Give a reason and at least a couple of sentences of detail.");
  await db.dispute.create({ data: { dealId: deal.id, openedByProfileId: me, reason, details, previousDealStatus: deal.status } });
  await transitionDeal(deal.id, "DISPUTED", user.id, reason);
  await db.payout.updateMany({ where: { dealId: deal.id, status: { in: ["HELD", "ELIGIBLE"] } }, data: { status: "ON_HOLD", holdReason: "Dispute under review" } });
  await notifyCounterparty(deal, me, "A dispute was opened — payout paused", deal.title);
  const admins = await db.user.findMany({ where: { platformRole: { in: ["ADMIN", "SUPERADMIN", "MODERATOR"] } }, select: { id: true } });
  for (const a of admins) await db.notification.create({ data: { userId: a.id, type: "account", title: "New dispute", body: deal.title, link: "/admin/moderation" } });
  ok(path, "Dispute opened. Payout is paused while our team reviews.");
}

export async function leaveReview(fd: FormData) {
  const { user, deal, me, path } = await loadParty(str(fd, "dealId"));
  if (deal.status !== "COMPLETED") fail(path, "Reviews open after the collaboration is completed.");
  const rating = int(fd, "rating");
  if (!rating || rating < 1 || rating > 5) fail(path, "Choose a rating from 1 to 5.");
  const exists = await db.review.findUnique({ where: { dealId_authorProfileId: { dealId: deal.id, authorProfileId: me } } });
  if (exists) fail(path, "You've already reviewed this collaboration.");
  const subject = otherParty(deal, me);
  await db.review.create({ data: { dealId: deal.id, authorProfileId: me, subjectProfileId: subject, rating: rating!, body: optStr(fd, "body", 2000) } });
  // Double-blind: publish both once both are in (or after the reveal window, via the jobs endpoint).
  const both = await db.review.count({ where: { dealId: deal.id } });
  if (both === 2) await db.review.updateMany({ where: { dealId: deal.id }, data: { state: "PUBLISHED" } });
  await notifyProfile(subject, "deals", { title: "You received a review", body: both === 2 ? "Both reviews are now visible." : "It will be visible once you leave yours (or after 14 days).", link: path });
  await track("review_left", user.id, { rating });
  ok(path, "Thanks for your review");
}

export async function addTrackingLink(fd: FormData) {
  const { deal, path } = await loadParty(str(fd, "dealId"));
  const dest = url(fd, "destination");
  if (!dest) fail(path, "Enter a valid destination URL.");
  const u = new URL(dest!);
  if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "majlis");
  if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", deal.kind.toLowerCase());
  if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", deal.campaignId ?? deal.id);
  await db.trackingLink.create({ data: { slug: randomToken(5).toLowerCase().replace(/[^a-z0-9]/g, "x"), destinationUrl: u.toString(), label: optStr(fd, "label", 80), couponCode: optStr(fd, "couponCode", 40), dealId: deal.id, campaignId: deal.campaignId } });
  ok(path, "Tracking link created");
}

export async function recordMetric(fd: FormData) {
  const { user, deal, me, agreed, path } = await loadParty(str(fd, "dealId"));
  if (!["IN_PROGRESS", "DELIVERED", "COMPLETED", "DISPUTED"].includes(deal.status)) fail(path, "Results can be logged once the collaboration is under way.");
  const key = str(fd, "key", 40);
  const value = Number(str(fd, "value").replace(/,/g, ""));
  if (!key || !Number.isFinite(value) || value < 0) fail(path, "Enter a metric and a value.");
  const isApprover = approverProfileId(deal, agreed) === me;
  await db.campaignMetric.create({ data: { dealId: deal.id, key, value, source: isApprover ? "ADVERTISER_REPORTED" : "CREATOR_REPORTED", note: optStr(fd, "note", 300), recordedByUserId: user.id } });
  ok(path, "Result logged");
}
