import Link from "next/link";
import type { DealStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Empty, Flash, PageHeader, Tabs } from "@/components/ui";
import { STATUS_LABEL, ACTIVE_STATUSES } from "@/lib/deal-machine";
import { formatAed } from "@/lib/money";
import { formatDate } from "@/lib/time";

const TABS: Record<string, DealStatus[]> = {
  incoming: ["PROPOSED"],
  active: ACTIVE_STATUSES,
  completed: ["COMPLETED"],
  closed: ["DECLINED", "CANCELLED"],
};

export default async function Deals({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { acting } = await requireActing();
  const tab = sp.tab && TABS[sp.tab] ? sp.tab : "active";
  const where = { OR: [{ initiatorProfileId: acting.id }, { recipientProfileId: acting.id }] };
  const [deals, counts] = await Promise.all([
    db.deal.findMany({
      where: { ...where, status: { in: TABS[tab] }, ...(tab === "incoming" ? { recipientProfileId: acting.id } : {}) },
      include: { initiator: true, recipient: true, proposals: { where: { status: { in: ["ACTIVE", "ACCEPTED"] } }, take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    Promise.all(Object.entries(TABS).map(async ([k, s]) => [k, await db.deal.count({ where: { ...where, status: { in: s }, ...(k === "incoming" ? { recipientProfileId: acting.id } : {}) } })] as const)),
  ]);
  const c = Object.fromEntries(counts);
  return (
    <div>
      <PageHeader title="Deals" sub="Invitations, applications, pitches and package requests — every collaboration in one pipeline." />
      <Flash sp={sp} />
      <Tabs active={`/app/deals?tab=${tab}`} items={[
        { href: "/app/deals?tab=incoming", label: "Needs your reply", count: c.incoming },
        { href: "/app/deals?tab=active", label: "Active", count: c.active },
        { href: "/app/deals?tab=completed", label: "Completed", count: c.completed },
        { href: "/app/deals?tab=closed", label: "Closed", count: c.closed },
      ]} />
      {deals.length ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Collaboration</th><th>With</th><th>Status</th><th>Value</th><th>Updated</th></tr></thead>
            <tbody>
              {deals.map((d) => {
                const other = d.initiatorProfileId === acting.id ? d.recipient : d.initiator;
                const p = d.proposals[0];
                return (
                  <tr key={d.id}>
                    <td><Link href={`/app/deals/${d.id}`} className="link font-medium">{d.title}</Link><div className="text-xs text-muted">{d.origin.replace("_", " ").toLowerCase()} · {d.kind.replaceAll("_", " ").toLowerCase()}</div></td>
                    <td>{other.displayName}</td>
                    <td><span className={d.status === "COMPLETED" ? "badge-ok" : d.status === "DISPUTED" ? "badge-bad" : d.status === "PROPOSED" ? "badge-gold" : "badge"}>{STATUS_LABEL[d.status]}</span></td>
                    <td>{p ? (p.priceFils ? formatAed(p.priceFils) : "Unpaid") : "—"}</td>
                    <td className="text-muted">{formatDate(d.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Nothing here yet" body={acting.type === "BRAND" || acting.type === "AGENCY" ? "Find creators and invite them, or create a campaign." : "Browse campaigns or pitch podcasts to get started."}
          action={<Link href={acting.type === "BRAND" || acting.type === "AGENCY" ? "/discover/influencers" : "/campaigns"} className="btn-primary">{acting.type === "BRAND" || acting.type === "AGENCY" ? "Discover creators" : "Browse campaigns"}</Link>} />
      )}
    </div>
  );
}
