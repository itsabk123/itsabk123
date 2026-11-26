import "server-only";
import { db } from "./db";
import { getConfig } from "./config";
import { notifyProfile, notifyUser } from "./notify";
import { buildWhere, TYPE_BY_PATH } from "./discovery";

/**
 * Background jobs. Run via POST /api/jobs (e.g. Vercel Cron or any scheduler) every 15–60 minutes.
 * Each job is idempotent and safe to re-run.
 */
export async function runJobs(now = new Date()) {
  const out: Record<string, number> = {};
  const reviewsCfg = await getConfig("reviews");

  // 1) Double-blind reviews: reveal after the window even if only one side reviewed.
  const cutoff = new Date(now.getTime() - reviewsCfg.revealAfterDays * 86400_000);
  out.reviewsRevealed = (await db.review.updateMany({ where: { state: "PENDING_REVEAL", createdAt: { lte: cutoff } }, data: { state: "PUBLISHED" } })).count;

  // 2) Booking reminders ~24h ahead.
  const soon = await db.booking.findMany({ where: { status: "CONFIRMED", reminderSentAt: null, startsAt: { gte: now, lte: new Date(now.getTime() + 26 * 3600_000) } } });
  for (const b of soon) {
    for (const pid of [b.providerProfileId, b.requesterProfileId]) await notifyProfile(pid, "bookings", { title: "Reminder: booking tomorrow", link: "/app/bookings" });
    await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: now } });
  }
  out.bookingReminders = soon.length;

  // 3) Unanswered proposals older than 3 days → gentle nudge to the recipient (once).
  const stale = await db.deal.findMany({ where: { status: "PROPOSED", createdAt: { lte: new Date(now.getTime() - 3 * 86400_000) }, events: { none: { type: "nudge" } } }, take: 200 });
  for (const d of stale) {
    await notifyProfile(d.recipientProfileId, "deals", { title: "A proposal is waiting for your reply", body: d.title, link: `/app/deals/${d.id}` });
    await db.dealEvent.create({ data: { dealId: d.id, type: "nudge" } });
  }
  out.proposalNudges = stale.length;

  // 4) Advertiser permit / verification document expiry reminders (30 days out).
  const expiring = await db.influencerDetails.findMany({ where: { permitExpiresAt: { gte: now, lte: new Date(now.getTime() + 30 * 86400_000) } }, select: { profileId: true } });
  for (const e of expiring) {
    const already = await db.notification.findFirst({ where: { type: "account", title: "Your advertiser permit expires soon", createdAt: { gte: new Date(now.getTime() - 14 * 86400_000) }, user: { profiles: { some: { id: e.profileId } } } } });
    if (!already) await notifyProfile(e.profileId, "account", { title: "Your advertiser permit expires soon", link: `/app/profiles/${e.profileId}/edit` });
  }
  out.permitReminders = expiring.length;
  out.docsExpired = (await db.verificationDocument.updateMany({ where: { status: "APPROVED", expiresAt: { lt: now } }, data: { status: "EXPIRED" } })).count;

  // 5) Payout auto-eligibility safety net: completed deals with no open dispute.
  const payoutCfg = await getConfig("payouts");
  const held = await db.payout.findMany({ where: { status: "HELD", deal: { status: "COMPLETED", completedAt: { lte: new Date(now.getTime() - payoutCfg.autoEligibleAfterDays * 86400_000) }, disputes: { none: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } } } });
  for (const p of held) await db.payout.update({ where: { id: p.id }, data: { status: "ELIGIBLE", holdReason: null } });
  out.payoutsEligible = held.length;

  // 6) Saved-search alerts (at most daily per search).
  const searches = await db.savedSearch.findMany({ where: { alert: true, OR: [{ lastAlertAt: null }, { lastAlertAt: { lte: new Date(now.getTime() - 86400_000) } }] }, take: 500 });
  let alerts = 0;
  for (const s of searches) {
    const since = s.lastAlertAt ?? s.createdAt;
    const sp = Object.fromEntries(new URLSearchParams(s.query));
    let count = 0;
    if (s.scope === "campaigns") count = await db.campaign.count({ where: { status: "OPEN", visibility: "PUBLIC", createdAt: { gt: since } } });
    else if (TYPE_BY_PATH[s.scope]) count = await db.profile.count({ where: { AND: [buildWhere(TYPE_BY_PATH[s.scope], sp), { createdAt: { gt: since } }] } });
    if (count > 0) {
      await notifyUser(s.userId, "opportunities", { title: `${count} new result${count > 1 ? "s" : ""} for “${s.name}”`, link: s.scope === "campaigns" ? `/campaigns?${s.query}` : `/discover/${s.scope}?${s.query}` });
      alerts++;
    }
    await db.savedSearch.update({ where: { id: s.id }, data: { lastAlertAt: now } });
  }
  out.searchAlerts = alerts;

  // 7) Churn signals → helpful nudges (never fake urgency). Profiles drafted >7 days ago and never published.
  const drafts = await db.profile.findMany({ where: { status: "DRAFT", createdAt: { lte: new Date(now.getTime() - 7 * 86400_000) }, updatedAt: { lte: new Date(now.getTime() - 7 * 86400_000) } }, take: 200 });
  for (const p of drafts) {
    const sent = await db.notification.findFirst({ where: { userId: p.ownerUserId, title: { startsWith: "Finish your profile" } } });
    if (!sent) await notifyUser(p.ownerUserId, "account", { title: `Finish your profile: ${p.displayName}`, body: "Published, complete profiles are the ones that get matched. It takes about 5 minutes.", link: `/app/profiles/${p.id}/edit` });
  }
  out.draftNudges = drafts.length;
  return out;
}
