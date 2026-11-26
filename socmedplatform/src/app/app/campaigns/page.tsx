import Link from "next/link";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { budgetLabel } from "@/components/campaign-card";
import { formatDate } from "@/lib/time";

export default async function MyCampaigns({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { acting, profiles } = await requireActing();
  const brandIds = profiles.filter((p) => p.type === "BRAND" || p.type === "AGENCY").map((p) => p.id);
  const campaigns = await db.campaign.findMany({ where: { brandProfileId: { in: brandIds } }, include: { brand: true, _count: { select: { deals: true } } }, orderBy: { updatedAt: "desc" } });
  const canCreate = acting.type === "BRAND" || acting.type === "AGENCY";
  return (
    <div>
      <PageHeader title="Campaigns" sub="Brief creators once, get matched recommendations, and manage every proposal." actions={canCreate ? <Link href="/app/campaigns/new" className="btn-primary">New campaign</Link> : undefined} />
      <Flash sp={sp} />
      {!canCreate && <p className="mb-4 text-sm text-muted">Switch to a brand or agency profile to create campaigns.</p>}
      {campaigns.length ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Campaign</th><th>Brand</th><th>Status</th><th>Budget</th><th>Proposals</th><th>Dates</th></tr></thead>
            <tbody>{campaigns.map((c) => (
              <tr key={c.id}><td><Link href={`/app/campaigns/${c.id}`} className="link font-medium">{c.name}</Link><div className="text-xs text-muted">{c.objective}</div></td><td>{c.brand.displayName}</td>
                <td><span className={c.status === "OPEN" ? "badge-ok" : c.status === "PENDING_REVIEW" ? "badge-warn" : "badge"}>{c.status.replace("_", " ").toLowerCase()}</span></td>
                <td>{budgetLabel(c)}</td><td>{c._count.deals}</td><td className="text-muted">{formatDate(c.startDate)} – {formatDate(c.endDate)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : canCreate ? <Empty title="No campaigns yet" body="A campaign brief lets us recommend the best-fit podcasts, creators and guests." action={<Link href="/app/campaigns/new" className="btn-primary">Create your first campaign</Link>} /> : null}
    </div>
  );
}
