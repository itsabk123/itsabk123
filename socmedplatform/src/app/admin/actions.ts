"use server";
import { redirect } from "next/navigation";
import type { DisputeStatus, PlatformRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bool, date, float, int, list, optStr, str } from "@/lib/forms";
import { audit } from "@/lib/audit";
import { DEFAULT_CONFIG, getConfig, setConfig } from "@/lib/config";
import { notifyProfile, notifyUser } from "@/lib/notify";
import { paymentProvider } from "@/lib/payments";
import { transitionDeal } from "@/lib/deals";
import { slugify } from "@/lib/slug";
import { parseAedToFils } from "@/lib/money";

const back = (p: string, ok: string) => redirect(`${p}?ok=${encodeURIComponent(ok)}`);

// ── Users ──
export async function setUserStatus(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR"]);
  const id = str(fd, "userId");
  const status = str(fd, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  if (id === admin.id) redirect("/admin/users?err=You+can%27t+suspend+yourself");
  const reason = optStr(fd, "reason", 300);
  await db.user.update({ where: { id }, data: { status, suspendedReason: status === "SUSPENDED" ? reason : null } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId: id } });
  await db.profile.updateMany({ where: { ownerUserId: id, status: status === "SUSPENDED" ? { in: ["PUBLISHED", "DRAFT", "HIDDEN"] } : "SUSPENDED" }, data: { status: status === "SUSPENDED" ? "SUSPENDED" : "HIDDEN" } });
  await audit(admin.id, `user.${status.toLowerCase()}`, { type: "User", id }, { reason });
  back("/admin/users", status === "SUSPENDED" ? "Suspended (profiles hidden, sessions revoked)" : "Restored — profiles hidden until the user republishes");
}

export async function setUserRole(fd: FormData) {
  const admin = await requireAdmin(["SUPERADMIN"]);
  if (admin.platformRole !== "SUPERADMIN") redirect("/admin/users?err=Only+a+superadmin+can+change+platform+roles");
  const role = str(fd, "role") as PlatformRole;
  if (!["USER", "MODERATOR", "FINANCE", "ADMIN", "SUPERADMIN"].includes(role)) redirect("/admin/users");
  await db.user.update({ where: { id: str(fd, "userId") }, data: { platformRole: role } });
  await audit(admin.id, "user.role", { type: "User", id: str(fd, "userId") }, { role });
  back("/admin/users", "Role updated");
}

export async function verifyProfile(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR"]);
  const id = str(fd, "profileId");
  const on = str(fd, "verified") === "1";
  await db.profile.update({ where: { id }, data: { verifiedAt: on ? new Date() : null } });
  if (on) await notifyProfile(id, "account", { title: "Your profile is verified", link: `/app/profiles/${id}/edit` });
  await audit(admin.id, on ? "profile.verify" : "profile.unverify", { type: "Profile", id });
  back(str(fd, "back") || "/admin/verification", on ? "Verified" : "Verification removed");
}

export async function featureProfile(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "profileId");
  const days = int(fd, "days") ?? 0;
  await db.profile.update({ where: { id }, data: { featuredUntil: days > 0 ? new Date(Date.now() + days * 86400_000) : null } });
  await audit(admin.id, "profile.feature", { type: "Profile", id }, { days });
  back("/admin/users", days > 0 ? `Featured for ${days} days (labelled as paid placement)` : "Feature removed");
}

// ── Verification documents ──
export async function reviewDocument(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR"]);
  const doc = await db.verificationDocument.findUniqueOrThrow({ where: { id: str(fd, "docId") } });
  const approve = str(fd, "decision") === "approve";
  await db.verificationDocument.update({ where: { id: doc.id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewerId: admin.id, reviewNotes: optStr(fd, "notes", 500), reviewedAt: new Date() } });
  if (approve && ["ADVERTISER_PERMIT", "VISITOR_ADVERTISER_PERMIT"].includes(doc.kind)) {
    await db.influencerDetails.updateMany({ where: { profileId: doc.profileId }, data: { advertiserPermitNo: doc.reference ?? undefined, permitExpiresAt: doc.expiresAt ?? undefined } });
  }
  if (approve && doc.kind === "ANALYTICS_EVIDENCE") {
    // Evidence reviewed by a human: mark accounts as checked (date shown), but never relabel as API-verified.
    await db.socialAccount.updateMany({ where: { profileId: doc.profileId }, data: { verifiedAt: new Date() } });
  }
  await db.complianceRecord.create({ data: { profileId: doc.profileId, check: `Document ${doc.kind}`, status: approve ? "APPROVED" : "REJECTED", notes: optStr(fd, "notes", 500), reviewerId: admin.id } });
  await notifyProfile(doc.profileId, "account", { title: `Document ${approve ? "approved" : "not approved"}`, body: optStr(fd, "notes", 500) ?? undefined, link: `/app/profiles/${doc.profileId}/edit#verification` });
  await audit(admin.id, `document.${approve ? "approve" : "reject"}`, { type: "VerificationDocument", id: doc.id });
  back("/admin/verification", approve ? "Approved" : "Rejected");
}

// ── Campaign compliance ──
export async function reviewCampaign(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR"]);
  const c = await db.campaign.findUniqueOrThrow({ where: { id: str(fd, "campaignId") } });
  const approve = str(fd, "decision") === "approve";
  const notes = optStr(fd, "notes", 1000);
  await db.campaign.update({ where: { id: c.id }, data: { complianceStatus: approve ? "APPROVED" : "REJECTED", complianceNotes: notes, status: approve && c.status === "PENDING_REVIEW" ? "OPEN" : approve ? c.status : "DRAFT" } });
  await db.complianceRecord.create({ data: { campaignId: c.id, check: "Regulated category review", status: approve ? "APPROVED" : "REJECTED", notes, reviewerId: admin.id } });
  await notifyProfile(c.brandProfileId, "account", { title: `Campaign ${approve ? "approved" : "needs changes"}: ${c.name}`, body: notes ?? undefined, link: `/app/campaigns/${c.id}` });
  await audit(admin.id, `campaign.compliance_${approve ? "approve" : "reject"}`, { type: "Campaign", id: c.id }, { notes });
  back("/admin/moderation", approve ? "Campaign approved and live" : "Campaign returned to draft");
}

// ── Reports & fraud ──
export async function resolveReport(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR"]);
  const status = str(fd, "status") === "ACTIONED" ? "ACTIONED" : "DISMISSED";
  await db.report.update({ where: { id: str(fd, "reportId") }, data: { status, resolution: optStr(fd, "resolution", 500) } });
  await audit(admin.id, `report.${status.toLowerCase()}`, { type: "Report", id: str(fd, "reportId") });
  back("/admin/moderation", "Report updated");
}

export async function resolveFlag(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR"]);
  const status = str(fd, "status") === "CONFIRMED" ? "CONFIRMED" : "CLEARED";
  await db.fraudFlag.update({ where: { id: str(fd, "flagId") }, data: { status } });
  await audit(admin.id, `fraud.${status.toLowerCase()}`, { type: "FraudFlag", id: str(fd, "flagId") });
  back("/admin/moderation", "Flag updated");
}

export async function releaseMessage(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR"]);
  const keep = str(fd, "decision") === "release";
  if (keep) await db.message.update({ where: { id: str(fd, "messageId") }, data: { flaggedSpam: false } });
  else await db.message.delete({ where: { id: str(fd, "messageId") } });
  await audit(admin.id, keep ? "message.release" : "message.delete", { type: "Message", id: str(fd, "messageId") });
  back("/admin/moderation", keep ? "Released" : "Deleted");
}

// ── Disputes ──
export async function resolveDispute(fd: FormData) {
  const admin = await requireAdmin(["MODERATOR", "FINANCE"]);
  const d = await db.dispute.findUniqueOrThrow({ where: { id: str(fd, "disputeId") }, include: { deal: { include: { payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } } }, payouts: true } } } });
  const outcome = str(fd, "outcome") as DisputeStatus;
  if (!["UNDER_REVIEW", "RESOLVED_RELEASE", "RESOLVED_REFUND", "RESOLVED_SPLIT"].includes(outcome)) redirect("/admin/moderation");
  const resolution = optStr(fd, "resolution", 2000);
  if (outcome === "UNDER_REVIEW") {
    await db.dispute.update({ where: { id: d.id }, data: { status: outcome } });
    back("/admin/moderation", "Marked under review");
  }
  const payment = d.deal.payments[0];
  const refundPct = outcome === "RESOLVED_REFUND" ? 100 : outcome === "RESOLVED_SPLIT" ? Math.max(0, Math.min(100, int(fd, "refundPct") ?? 50)) : 0;
  if (payment && refundPct > 0) {
    const amount = Math.round(((payment.amountFils - payment.refundedFils) * refundPct) / 100);
    await db.refund.create({ data: { paymentId: payment.id, amountFils: amount, reason: `Dispute resolution: ${resolution ?? outcome}`, status: "APPROVED" } });
    const r = await paymentProvider(payment.provider).refund(payment.providerRef ?? "", amount);
    await audit(admin.id, "refund.issue", { type: "Payment", id: payment.id }, { amount, ok: r.ok });
  }
  for (const po of d.deal.payouts.filter((p) => p.status !== "PAID" && p.status !== "CANCELLED")) {
    if (refundPct >= 100) await db.payout.update({ where: { id: po.id }, data: { status: "CANCELLED", holdReason: "Refunded after dispute" } });
    else await db.payout.update({ where: { id: po.id }, data: { status: "ELIGIBLE", amountFils: Math.round((po.amountFils * (100 - refundPct)) / 100), holdReason: null } });
  }
  await db.dispute.update({ where: { id: d.id }, data: { status: outcome, resolution, resolvedAt: new Date() } });
  await transitionDeal(d.dealId, refundPct >= 100 ? "CANCELLED" : "COMPLETED", admin.id, `dispute ${outcome}`, refundPct >= 100 ? { cancelledReason: "Refunded after dispute" } : { completedAt: new Date() });
  for (const pid of [d.deal.initiatorProfileId, d.deal.recipientProfileId]) await notifyProfile(pid, "deals", { title: "Dispute resolved", body: resolution ?? undefined, link: `/app/deals/${d.dealId}` });
  await audit(admin.id, "dispute.resolve", { type: "Dispute", id: d.id }, { outcome, refundPct });
  back("/admin/moderation", "Dispute resolved");
}

// ── Finance ──
export async function markPayoutPaid(fd: FormData) {
  const admin = await requireAdmin(["FINANCE"]);
  const po = await db.payout.findUniqueOrThrow({ where: { id: str(fd, "payoutId") }, include: { deal: { include: { disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } } } } });
  // Guard rail: never pay out before completion or while a dispute is open.
  if (po.status !== "ELIGIBLE" || po.deal.status !== "COMPLETED" || po.deal.disputes.length) redirect("/admin/finance?err=Payout+is+not+eligible");
  const reference = str(fd, "reference", 120);
  if (!reference) redirect("/admin/finance?err=Enter+the+bank+transfer+reference");
  await db.payout.update({ where: { id: po.id }, data: { status: "PAID", paidAt: new Date(), reference } });
  await notifyProfile(po.payeeProfileId, "payments", { title: "Payout sent", body: `Reference ${reference}`, link: "/app/finance" });
  await audit(admin.id, "payout.paid", { type: "Payout", id: po.id }, { reference, amountFils: po.amountFils });
  back("/admin/finance", "Payout recorded as paid");
}

// ── Configuration ──
export async function saveCommission(fd: FormData) {
  const admin = await requireAdmin();
  const cur = await getConfig("commission");
  const next = { ...cur };
  for (const k of ["PODCAST_SPONSORSHIP", "INFLUENCER_CAMPAIGN", "GUEST_APPEARANCE", "UGC_PRODUCTION", "EVENT_APPEARANCE", "AMBASSADOR", "OTHER", "agencyDiscountPct"] as const) {
    const v = float(fd, k);
    if (v !== null && v >= 0 && v <= 50) next[k] = v;
  }
  const min = parseAedToFils(fd.get("minimumDeal"));
  if (min !== null) next.minimumDealFils = min;
  await setConfig("commission", next, admin.id);
  const vat = await getConfig("vat");
  await setConfig("vat", { ratePct: float(fd, "vatRate") ?? vat.ratePct, applyToPlatformFee: bool(fd, "vatOnFee"), trn: str(fd, "trn", 30) }, admin.id);
  await audit(admin.id, "config.commission", undefined, { before: cur, after: next });
  back("/admin/config", "Commission & VAT saved — applies to new agreements");
}

export async function saveWeights(fd: FormData) {
  const admin = await requireAdmin();
  const w = { ...DEFAULT_CONFIG.matchWeights };
  for (const k of Object.keys(w) as (keyof typeof w)[]) w[k] = Math.max(0, Math.min(100, float(fd, k) ?? w[k]));
  await setConfig("matchWeights", w, admin.id);
  await audit(admin.id, "config.weights", undefined, w);
  back("/admin/config", "Match weights saved");
}

export async function saveLimits(fd: FormData) {
  const admin = await requireAdmin();
  await setConfig("freeTier", { activeCampaigns: int(fd, "activeCampaigns") ?? 1, monthlyInvites: int(fd, "monthlyInvites") ?? 10, monthlyApplications: int(fd, "monthlyApplications") ?? 10 }, admin.id);
  await setConfig("prohibitedCategories", list(fd, "prohibited"), admin.id);
  await setConfig("features", { aiAssist: bool(fd, "aiAssist"), featuredListings: bool(fd, "featuredListings"), whatsapp: false, subscriptionsCheckout: false }, admin.id);
  await setConfig("reviews", { revealAfterDays: int(fd, "revealAfterDays") ?? 14 }, admin.id);
  await audit(admin.id, "config.limits");
  back("/admin/config", "Saved");
}

export async function savePlan(fd: FormData) {
  const admin = await requireAdmin();
  const code = slugify(str(fd, "code", 40)).toUpperCase().replace(/-/g, "_");
  if (!code) redirect("/admin/config?err=Plan+code+required");
  const data = {
    name: str(fd, "name", 60), audience: str(fd, "audience", 20) || "ALL", tagline: optStr(fd, "tagline", 160),
    priceMonthlyFils: parseAedToFils(fd.get("priceMonthly")) ?? 0, priceYearlyFils: parseAedToFils(fd.get("priceYearly")) ?? 0,
    features: str(fd, "features", 3000).split("\n").map((s) => s.trim()).filter(Boolean), limits: {}, isActive: bool(fd, "isActive"), sort: int(fd, "sort") ?? 0,
  };
  await db.plan.upsert({ where: { code }, create: { code, ...data }, update: data });
  await audit(admin.id, "plan.save", { type: "Plan", id: code });
  back("/admin/config", "Plan saved");
}

export async function savePromotion(fd: FormData) {
  const admin = await requireAdmin();
  const code = str(fd, "code", 30).toUpperCase();
  if (!code) redirect("/admin/config?err=Code+required");
  const data = { name: str(fd, "name", 80), description: optStr(fd, "description", 300), kind: str(fd, "kind", 40), value: float(fd, "value") ?? 0, audience: str(fd, "audience", 20) || "ALL", endsAt: date(fd, "endsAt"), maxRedemptions: int(fd, "maxRedemptions"), isActive: bool(fd, "isActive") };
  await db.promotion.upsert({ where: { code }, create: { code, ...data }, update: data });
  await audit(admin.id, "promotion.save", { type: "Promotion", id: code });
  back("/admin/config", "Promotion saved");
}

export async function grantPlan(fd: FormData) {
  const admin = await requireAdmin(["FINANCE"]);
  const user = await db.user.findUnique({ where: { email: str(fd, "email").toLowerCase() } });
  const plan = await db.plan.findUnique({ where: { code: str(fd, "planCode") } });
  if (!user || !plan) redirect("/admin/config?err=User+or+plan+not+found");
  await db.subscription.updateMany({ where: { userId: user.id, status: "ACTIVE" }, data: { status: "CANCELLED" } });
  await db.subscription.create({ data: { userId: user.id, planId: plan.id, status: "ACTIVE", provider: "manual", currentPeriodEnd: date(fd, "until") } });
  await notifyUser(user.id, "account", { title: `Your ${plan.name} plan is active` });
  await audit(admin.id, "subscription.grant", { type: "User", id: user.id }, { plan: plan.code });
  back("/admin/config", "Plan granted");
}

// ── Content ──
export async function savePost(fd: FormData) {
  const admin = await requireAdmin();
  const title = str(fd, "title", 200);
  const slug = slugify(str(fd, "slug", 80) || title);
  const status = str(fd, "status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const id = str(fd, "id");
  const data = { kind: str(fd, "kind", 20) || "BLOG", title, slug, excerpt: optStr(fd, "excerpt", 300), body: str(fd, "body", 50000), status, authorName: optStr(fd, "authorName", 80) };
  if (id) {
    const prev = await db.post.findUniqueOrThrow({ where: { id } });
    await db.post.update({ where: { id }, data: { ...data, publishedAt: status === "PUBLISHED" ? prev.publishedAt ?? new Date() : prev.publishedAt } });
  } else await db.post.create({ data: { ...data, publishedAt: status === "PUBLISHED" ? new Date() : null } });
  await audit(admin.id, "post.save", { type: "Post", id: slug });
  back("/admin/content", "Saved");
}

export async function markContactHandled(fd: FormData) {
  await requireAdmin(["MODERATOR"]);
  await db.contactMessage.update({ where: { id: str(fd, "id") }, data: { handled: true } });
  back("/admin/content", "Marked handled");
}
