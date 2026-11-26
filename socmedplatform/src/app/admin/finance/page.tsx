import Link from "next/link";
import { db } from "@/lib/db";
import { Flash, PageHeader, Stat } from "@/components/ui";
import { formatAed } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { markPayoutPaid } from "../actions";

export default async function AdminFinance({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [payments, eligible, held, refunds, events, sums] = await Promise.all([
    db.payment.findMany({ include: { deal: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.payout.findMany({ where: { status: "ELIGIBLE" }, include: { deal: { select: { id: true, title: true } } }, orderBy: { createdAt: "asc" } }),
    db.payout.aggregate({ where: { status: { in: ["HELD", "ON_HOLD"] } }, _sum: { amountFils: true }, _count: true }),
    db.refund.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.webhookEvent.findMany({ orderBy: { processedAt: "desc" }, take: 20 }),
    db.payment.groupBy({ by: ["status"], _sum: { amountFils: true, commissionFils: true, vatFils: true }, _count: true }),
  ]);
  const payees = await db.profile.findMany({ where: { id: { in: eligible.map((e) => e.payeeProfileId) } }, select: { id: true, displayName: true } });
  const s = (k: string) => sums.find((x) => x.status === k);
  return (
    <div className="space-y-8">
      <PageHeader title="Finance" sub="Payments are only counted once the provider confirms them. Payouts can only be marked paid after completion with no open dispute." />
      <Flash sp={sp} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Confirmed payments" value={formatAed(s("SUCCEEDED")?._sum.amountFils ?? 0)} note={`${s("SUCCEEDED")?._count ?? 0} payments`} />
        <Stat label="Commission (gross)" value={formatAed(sums.reduce((a, x) => a + (x._sum.commissionFils ?? 0), 0))} note={`VAT on fees ${formatAed(sums.reduce((a, x) => a + (x._sum.vatFils ?? 0), 0))}`} />
        <Stat label="Held / on hold" value={formatAed(held._sum.amountFils ?? 0)} note={`${held._count} payouts`} />
        <Stat label="Failed / pending" value={`${s("FAILED")?._count ?? 0} / ${s("PENDING")?._count ?? 0}`} />
      </div>
      <section>
        <h2 className="h3 mb-3">Payouts ready to send</h2>
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Payee</th><th>Deal</th><th>Net</th><th>Record transfer</th></tr></thead>
          <tbody>{eligible.map((p) => (
            <tr key={p.id}><td>{payees.find((x) => x.id === p.payeeProfileId)?.displayName}</td><td><Link href={`/app/deals/${p.deal.id}`} className="link">{p.deal.title}</Link></td><td>{formatAed(p.amountFils)}</td>
              <td><form action={markPayoutPaid} className="flex gap-1"><input type="hidden" name="payoutId" value={p.id} /><input name="reference" className="input !min-h-[32px] !py-0 text-xs" placeholder="Bank reference" required /><button className="btn-primary btn-sm">Mark paid</button></form></td></tr>
          ))}{!eligible.length && <tr><td colSpan={4} className="text-muted">None.</td></tr>}</tbody>
        </table></div>
      </section>
      <section>
        <h2 className="h3 mb-3">Recent payments</h2>
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Created</th><th>Deal</th><th>Amount</th><th>Fee</th><th>Provider</th><th>Status</th></tr></thead>
          <tbody>{payments.map((p) => <tr key={p.id}><td className="text-muted">{formatDate(p.createdAt)}</td><td><Link href={`/app/deals/${p.deal.id}`} className="link">{p.deal.title}</Link></td><td>{formatAed(p.amountFils)}</td><td>{formatAed(p.commissionFils)}</td><td>{p.provider}<div className="text-xs text-muted">{p.providerRef}</div></td><td><span className="badge">{p.status.toLowerCase()}</span>{p.failureReason && <div className="text-xs text-bad">{p.failureReason}</div>}</td></tr>)}</tbody>
        </table></div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section><h2 className="h3 mb-3">Refunds</h2><div className="card divide-y divide-line text-sm">{refunds.map((r) => <div key={r.id} className="flex justify-between px-4 py-2"><span>{formatAed(r.amountFils)} · {r.reason}</span><span className="badge">{r.status.toLowerCase()}</span></div>)}{!refunds.length && <p className="p-4 text-muted">None.</p>}</div></section>
        <section><h2 className="h3 mb-3">Webhook log (reconciliation)</h2><div className="card divide-y divide-line text-xs">{events.map((e) => <div key={e.id} className="flex justify-between px-4 py-2"><span>{e.provider} · {e.type} · {e.eventId}</span><span className="text-muted">{formatDateTime(e.processedAt)}</span></div>)}{!events.length && <p className="p-4 text-muted">No events.</p>}</div></section>
      </div>
    </div>
  );
}
