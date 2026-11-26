import { db } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";
import { formatAed, formatNumber } from "@/lib/money";

export default async function AdminHome() {
  const d30 = new Date(Date.now() - 30 * 86400_000);
  const d90 = new Date(Date.now() - 90 * 86400_000);
  const [users, active30, newUsers, verified, byType, campaigns, completed, gmv, commission, refunds, disputes, subs, funnel, repeatPairs] = await Promise.all([
    db.user.count({ where: { status: { not: "DELETED" } } }),
    db.user.count({ where: { lastActiveAt: { gte: d30 }, status: "ACTIVE" } }),
    db.user.count({ where: { createdAt: { gte: d30 } } }),
    db.profile.count({ where: { verifiedAt: { not: null } } }),
    db.profile.groupBy({ by: ["type"], where: { status: "PUBLISHED" }, _count: true }),
    db.campaign.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.deal.count({ where: { status: "COMPLETED" } }),
    db.payment.aggregate({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } }, _sum: { amountFils: true, refundedFils: true } }),
    db.payment.aggregate({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] }, deal: { status: "COMPLETED" } }, _sum: { commissionFils: true } }),
    db.refund.aggregate({ where: { status: { in: ["APPROVED", "PROCESSED"] } }, _sum: { amountFils: true } }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } }),
    Promise.all(["signup", "profile_published", "invite_sent", "application_submitted", "pitch_sent", "proposal_accepted", "deal_funded", "deal_completed"].map(async (n) => [n, await db.analyticsEvent.count({ where: { name: n, createdAt: { gte: d90 } } })] as const)),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM (SELECT LEAST("initiatorProfileId","recipientProfileId") a, GREATEST("initiatorProfileId","recipientProfileId") b FROM "Deal" WHERE status = 'COMPLETED' GROUP BY 1,2 HAVING COUNT(*) > 1) t`,
  ]);
  const mrr = subs.reduce((s, x) => s + x.plan.priceMonthlyFils, 0);
  const t = (k: string) => byType.find((b) => b.type === k)?._count ?? 0;
  const f = Object.fromEntries(funnel);
  return (
    <div>
      <PageHeader title="Platform overview" sub="All figures computed live from the database. No benchmarks are assumed — set targets from observed behaviour." />
      <h2 className="h3 mb-3">Users</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Registered" value={formatNumber(users)} note={`${newUsers} in last 30 days`} />
        <Stat label="Active (30d)" value={formatNumber(active30)} />
        <Stat label="Verified profiles" value={formatNumber(verified)} />
        <Stat label="Published profiles" value={`${t("BRAND")} / ${t("PODCAST")} / ${t("INFLUENCER")} / ${t("GUEST")}`} note="brands / podcasts / influencers / guests" />
      </div>
      <h2 className="h3 mb-3">Marketplace & money</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active campaigns" value={campaigns} />
        <Stat label="Completed collaborations" value={completed} note={`${Number(repeatPairs[0]?.n ?? 0)} repeat partner pairs`} />
        <Stat label="GMV (confirmed payments)" value={formatAed((gmv._sum.amountFils ?? 0) - (gmv._sum.refundedFils ?? 0), { compact: true })} note="net of refunds" />
        <Stat label="Commission earned" value={formatAed(commission._sum.commissionFils ?? 0)} note="on completed deals" />
        <Stat label="Subscription MRR" value={formatAed(mrr)} note={`${subs.length} active plans`} />
        <Stat label="Refunds" value={formatAed(refunds._sum.amountFils ?? 0)} />
        <Stat label="Open disputes" value={disputes} />
      </div>
      <h2 className="h3 mb-3">Funnel (last 90 days)</h2>
      <div className="card overflow-x-auto">
        <table className="table"><tbody>
          {[["Sign-ups", "signup"], ["Profiles published", "profile_published"], ["Invitations sent", "invite_sent"], ["Applications", "application_submitted"], ["Guest pitches", "pitch_sent"], ["Terms agreed", "proposal_accepted"], ["Deals funded", "deal_funded"], ["Deals completed", "deal_completed"]].map(([l, k]) => (
            <tr key={k}><td>{l}</td><td className="w-24 text-end text-ink">{formatNumber(f[k] ?? 0)}</td><td className="w-1/2"><div className="h-1.5 rounded-full bg-paper-deep"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${f.signup ? Math.min(100, ((f[k] ?? 0) / f.signup) * 100) : 0}%` }} /></div></td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}
