import "server-only";
import type { DealKind, DealOrigin, DealStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { assertTransition } from "./deal-machine";
import { notifyProfile } from "./notify";
import { track } from "./audit";

export type ProposalInput = {
  priceFils: number;
  payerProfileId: string | null;
  deliverables: { title: string; dueDate?: string | null }[];
  publishDate?: Date | null;
  usageRights?: string | null;
  exclusivity?: string | null;
  revisions?: number;
  message?: string | null;
};

export async function createDeal(input: {
  origin: DealOrigin;
  kind: DealKind;
  title: string;
  initiatorProfileId: string;
  recipientProfileId: string;
  campaignId?: string | null;
  offeringId?: string | null;
  matchScore?: number | null;
  proposal: ProposalInput;
  actorUserId: string;
}) {
  if (input.initiatorProfileId === input.recipientProfileId) throw new Error("You cannot start a deal with yourself.");
  const blocked = await db.block.findFirst({
    where: {
      OR: [
        { blockerProfileId: input.recipientProfileId, blockedProfileId: input.initiatorProfileId },
        { blockerProfileId: input.initiatorProfileId, blockedProfileId: input.recipientProfileId },
      ],
    },
  });
  if (blocked) throw new Error("This profile is not accepting requests from you.");
  const existing = await db.deal.findFirst({
    where: {
      initiatorProfileId: input.initiatorProfileId,
      recipientProfileId: input.recipientProfileId,
      campaignId: input.campaignId ?? null,
      status: { in: ["PROPOSED", "NEGOTIATING"] },
    },
  });
  if (existing) return existing;

  const deal = await db.$transaction(async (tx) => {
    const d = await tx.deal.create({
      data: {
        origin: input.origin,
        kind: input.kind,
        title: input.title.slice(0, 160),
        initiatorProfileId: input.initiatorProfileId,
        recipientProfileId: input.recipientProfileId,
        campaignId: input.campaignId ?? null,
        offeringId: input.offeringId ?? null,
        matchScore: input.matchScore ?? null,
      },
    });
    await tx.proposal.create({ data: proposalData(d.id, input.initiatorProfileId, input.proposal) });
    const convo = await tx.conversation.create({
      data: {
        dealId: d.id,
        subject: d.title,
        participants: { create: [{ profileId: input.initiatorProfileId, lastReadAt: new Date() }, { profileId: input.recipientProfileId }] },
      },
    });
    if (input.proposal.message) {
      await tx.message.create({ data: { conversationId: convo.id, senderProfileId: input.initiatorProfileId, senderUserId: input.actorUserId, body: input.proposal.message } });
    }
    await tx.dealEvent.create({ data: { dealId: d.id, actorUserId: input.actorUserId, type: "created", detail: input.origin } });
    for (const [owner, contact, stage] of [
      [input.initiatorProfileId, input.recipientProfileId, "CONTACTED"],
      [input.recipientProfileId, input.initiatorProfileId, "NEW_LEAD"],
    ] as const) {
      await tx.crmContact.upsert({
        where: { ownerProfileId_contactProfileId: { ownerProfileId: owner, contactProfileId: contact } },
        create: { ownerProfileId: owner, contactProfileId: contact, stage },
        update: {},
      });
    }
    return d;
  });

  const verb = { INVITATION: "invited you", APPLICATION: "applied to your campaign", PITCH: "pitched you", PACKAGE_REQUEST: "requested a package" }[input.origin];
  const from = await db.profile.findUnique({ where: { id: input.initiatorProfileId }, select: { displayName: true } });
  await notifyProfile(input.recipientProfileId, "deals", { title: `${from?.displayName ?? "Someone"} ${verb}`, body: deal.title, link: `/app/deals/${deal.id}` });
  await track(input.origin === "APPLICATION" ? "application_submitted" : input.origin === "PITCH" ? "pitch_sent" : "invite_sent", input.actorUserId, { kind: input.kind });
  return deal;
}

export function proposalData(dealId: string, authorProfileId: string, p: ProposalInput): Prisma.ProposalUncheckedCreateInput {
  return {
    dealId,
    authorProfileId,
    priceFils: Math.max(0, Math.round(p.priceFils)),
    payerProfileId: p.priceFils > 0 ? p.payerProfileId : null,
    deliverables: p.deliverables.slice(0, 20),
    publishDate: p.publishDate ?? null,
    usageRights: p.usageRights ?? null,
    exclusivity: p.exclusivity ?? null,
    revisions: Math.max(0, Math.min(5, p.revisions ?? 1)),
    message: p.message ?? null,
  };
}

export async function transitionDeal(dealId: string, to: DealStatus, actorUserId: string | null, detail?: string, extra: Prisma.DealUpdateInput = {}) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  assertTransition(deal.status, to);
  const updated = await db.deal.update({ where: { id: dealId, status: deal.status }, data: { status: to, ...extra } });
  await db.dealEvent.create({ data: { dealId, actorUserId, type: `status:${to}`, detail } });
  return updated;
}

/** Notifies the other party in a deal. */
export async function notifyCounterparty(deal: { id: string; initiatorProfileId: string; recipientProfileId: string }, actingProfileId: string, title: string, body?: string) {
  const other = deal.initiatorProfileId === actingProfileId ? deal.recipientProfileId : deal.initiatorProfileId;
  await notifyProfile(other, "deals", { title, body, link: `/app/deals/${deal.id}` });
}
