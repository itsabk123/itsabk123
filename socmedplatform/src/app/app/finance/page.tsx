import Link from "next/link";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { formatAed } from "@/lib/money";
import { formatDate } from "@/lib/time";

export default async function Finance() {
  const { acting, profiles } = await requireActing();
  const ids = profiles.map((p) => p.id);
  const [payments, payouts] = await Promise.all([
    db.payment.findMany({ where: { payerProfileId: { in: ids } }, include: { deal: { select: { id: true, title: true } }, invoice: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.payout.findMany({ where: { payeeProfileId: { in: ids } }, include: { deal: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const spent = payments.filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED").reduce((s, p) => s + p.amountFils - p.refundedFils, 0);
  const earned = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountFils, 0);
  const pending = payouts.filter((p) => ["HELD", "ELIGIBLE"].includes(p.status)).reduce((s, p) => s + p.amountFils, 0);
  const onHold = payouts.filter((p) => p.status === "ON_HOLD").reduce((s, p) => s + p.amountFils, 0);
  return (
    <div>
      <PageHeader title="Payments" sub={`Across all your profiles. Only payments confirmed by the payment provider are counted.`} />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Spent (confirmed)" value={formatAed(spent)} />
        <Stat label="Earned (paid out)" value={formatAed(earned)} />
        <Stat label="Pending payout" value={formatAed(pending)} note="Held until approval, then released" />
        <Stat label="On hold" value={formatAed(onHold)} note="Paused by a dispute" />
      </div>
      <h2 className="h3 mb-3">Payments made</h2>
      {payments.length ? (
        <div className="card mb-10 overflow-x-auto"><table className="table">
          <thead><tr><th>Date</th><th>Deal</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead>
          <tbody>{payments.map((p) => (
            <tr key={p.id}><td className="text-muted">{formatDate(p.createdAt)}</td><td><Link href={`/app/deals/${p.deal.id}`} className="link">{p.deal.title}</Link></td><td>{formatAed(p.amountFils)}{p.refundedFils ? <div className="text-xs text-muted">refunded {formatAed(p.refundedFils)}</div> : null}</td>
              <td><span className={p.status === "SUCCEEDED" ? "badge-ok" : p.status === "FAILED" ? "badge-bad" : "badge"}>{p.status.replace("_", " ").toLowerCase()}</span></td>
              <td>{p.invoice ? <Link href={`/app/finance/invoices/${p.invoice.id}`} className="link">{p.invoice.number}</Link> : "—"}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <div className="mb-10"><Empty title="No payments yet" /></div>}
      <h2 className="h3 mb-3">Payouts to you</h2>
      {payouts.length ? (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Created</th><th>Deal</th><th>Net amount</th><th>Status</th><th>Paid</th></tr></thead>
          <tbody>{payouts.map((p) => (
            <tr key={p.id}><td className="text-muted">{formatDate(p.createdAt)}</td><td><Link href={`/app/deals/${p.deal.id}`} className="link">{p.deal.title}</Link></td><td>{formatAed(p.amountFils)}</td>
              <td><span className={p.status === "PAID" ? "badge-ok" : p.status === "ON_HOLD" ? "badge-bad" : "badge-warn"}>{p.status.toLowerCase()}</span>{p.holdReason && <div className="text-xs text-muted">{p.holdReason}</div>}</td><td className="text-muted">{formatDate(p.paidAt)}{p.reference ? ` · ${p.reference}` : ""}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <Empty title="No payouts yet" body="Payouts are created when a payment is confirmed and released when deliverables are approved." />}
      <p className="mt-6 text-xs text-muted">Acting as {acting.displayName}. Payout bank details are collected securely by our finance team during onboarding of your first paid deal.</p>
    </div>
  );
}
