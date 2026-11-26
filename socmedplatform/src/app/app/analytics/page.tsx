import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Empty, PageHeader, SourceTag, Stat } from "@/components/ui";
import { formatAed, formatNumber } from "@/lib/money";

export default async function Analytics() {
  const { acting } = await requireActing();
  const where = { OR: [{ initiatorProfileId: acting.id }, { recipientProfileId: acting.id }] };
  const since = new Date(Date.now() - 30 * 86400_000);
  const [deals, metrics, links, views, views30] = await Promise.all([
    db.deal.groupBy({ by: ["status"], where, _count: true }),
    db.campaignMetric.groupBy({ by: ["key", "source"], where: { deal: where }, _sum: { value: true } }),
    db.trackingLink.aggregate({ where: { deal: where }, _sum: { clicks: true }, _count: true }),
    db.analyticsEvent.count({ where: { name: "profile_view", props: { path: ["profileId"], equals: acting.id } } }),
    db.analyticsEvent.count({ where: { name: "profile_view", createdAt: { gte: since }, props: { path: ["profileId"], equals: acting.id } } }),
  ]);
  const paid = await db.payment.aggregate({ where: { status: "SUCCEEDED", deal: where, payerProfileId: acting.id }, _sum: { amountFils: true } });
  const earned = await db.payout.aggregate({ where: { payeeProfileId: acting.id, status: { in: ["ELIGIBLE", "PAID"] } }, _sum: { amountFils: true } });
  const count = (s: string) => deals.find((d) => d.status === s)?._count ?? 0;
  const total = deals.reduce((s, d) => s + d._count, 0);
  const decided = count("COMPLETED") + count("DECLINED") + count("CANCELLED") + count("IN_PROGRESS") + count("FUNDED") + count("CONTRACTED") + count("DELIVERED") + count("AGREED");
  return (
    <div>
      <PageHeader title="Performance" sub={`For ${acting.displayName}. Every figure is labelled with where it came from.`} />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Profile views (30 days)" value={formatNumber(views30)} note={`${formatNumber(views)} all time · counted by platform`} />
        <Stat label="Deals" value={total} note={`${count("COMPLETED")} completed`} />
        <Stat label="Acceptance rate" value={decided ? `${Math.round(((decided - count("DECLINED")) / decided) * 100)}%` : "—"} note="Proposals not declined" />
        <Stat label={acting.type === "BRAND" || acting.type === "AGENCY" ? "Spend (confirmed)" : "Earnings (net)"} value={formatAed(acting.type === "BRAND" || acting.type === "AGENCY" ? paid._sum.amountFils ?? 0 : earned._sum.amountFils ?? 0)} />
      </div>
      <h2 className="h3 mb-3">Campaign results</h2>
      {metrics.length || links._count ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Metric</th><th>Total</th><th>Source</th></tr></thead>
            <tbody>
              <tr><td>Tracked link clicks</td><td>{formatNumber(links._sum.clicks ?? 0)}</td><td><SourceTag source="API_VERIFIED" /> <span className="text-xs text-muted">counted by platform across {links._count} link(s)</span></td></tr>
              {metrics.map((m) => <tr key={`${m.key}-${m.source}`}><td>{m.key.replaceAll("_", " ")}</td><td>{m.key === "revenue_aed" ? formatAed((m._sum.value ?? 0) * 100) : formatNumber(m._sum.value ?? 0)}</td><td><SourceTag source={m.source} /></td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No results logged yet" body="Create tracked links and log results from each deal page." />}
      <p className="mt-4 text-xs text-muted">We never combine figures from different sources into one number. Attribution beyond tracked-link clicks relies on what partners report.</p>
    </div>
  );
}
