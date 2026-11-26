import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, hasPlatformRole } from "@/lib/auth";
import { canActFor } from "@/lib/access";
import { formatAed } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { getConfig } from "@/lib/config";
import { SITE } from "@/lib/site";

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const inv = await db.invoice.findUnique({ where: { id }, include: { payment: { include: { deal: true } } } });
  if (!inv) notFound();
  const allowed = hasPlatformRole(user, ["FINANCE"]) || (await canActFor(user.id, inv.payment.payerProfileId, false));
  if (!allowed) redirect("/app/finance?err=Not+authorised");
  const vat = await getConfig("vat");
  const lines = inv.lines as { description: string; amountFils: number }[];
  return (
    <div className="card-pad mx-auto max-w-2xl print:border-0">
      <div className="flex justify-between">
        <div><div className="font-serif text-2xl text-ink">{SITE.name}</div>{vat.trn ? <div className="text-xs text-muted">TRN {vat.trn}</div> : <div className="text-xs text-warn">TRN not configured — not a tax invoice</div>}</div>
        <div className="text-end text-sm"><div className="h3">Receipt {inv.number}</div><div className="text-muted">{formatDate(inv.issuedAt)}</div></div>
      </div>
      <div className="mt-8 text-sm"><div className="stat-label">Billed to</div><div>{inv.billedTo}</div></div>
      <table className="table mt-6">
        <thead><tr><th>Description</th><th className="text-end">Amount</th></tr></thead>
        <tbody>
          {lines.map((l, i) => <tr key={i}><td>{l.description}<div className="text-xs text-muted">Collaboration fee collected on behalf of the creator</div></td><td className="text-end">{formatAed(l.amountFils)}</td></tr>)}
          <tr><td className="text-end text-muted">Total paid</td><td className="text-end font-medium text-ink">{formatAed(inv.totalFils)}</td></tr>
        </tbody>
      </table>
      <p className="mt-6 text-xs text-muted">Payment confirmed by {inv.payment.provider} on {formatDate(inv.payment.confirmedAt)}. The platform's own fee is invoiced to the creator separately and VAT at {vat.ratePct}% is applied to that fee. Have VAT treatment confirmed by a UAE tax adviser before launch.</p>
      <button className="btn-secondary btn-sm mt-6 print:hidden" type="button">Use your browser's print to save as PDF</button>
    </div>
  );
}
