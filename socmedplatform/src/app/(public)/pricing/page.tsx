import Link from "next/link";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { formatAed } from "@/lib/money";

export const metadata = { title: "Pricing", description: "Free to join. Pay a commission only on successful paid collaborations. Optional plans for advanced tools." };
export const dynamic = "force-dynamic";

export default async function Pricing() {
  const [plans, commission, vat] = await Promise.all([db.plan.findMany({ where: { isActive: true }, orderBy: { sort: "asc" } }), getConfig("commission"), getConfig("vat")]);
  return (
    <div className="page py-14">
      <div className="eyebrow mb-3">Pricing</div>
      <h1 className="h1 max-w-3xl">Free to join. We earn when you do.</h1>
      <p className="lead mt-5">Create profiles, search and agree collaborations for free. On paid deals, a platform fee is deducted from the creator's payout. Plans unlock advanced tools.</p>

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <div key={p.id} className="card-pad flex flex-col">
            <div className="eyebrow">{p.audience === "ALL" ? "Everyone" : p.audience.toLowerCase()}</div>
            <div className="h3 mt-1 text-lg">{p.name}</div>
            {p.tagline && <p className="mt-1 text-sm text-muted">{p.tagline}</p>}
            <div className="mt-4 font-serif text-3xl text-ink">{p.priceMonthlyFils ? formatAed(p.priceMonthlyFils) : p.code === "FREE" ? "Free" : <span className="text-xl">Founding pricing on request</span>}<span className="text-sm text-muted">{p.priceMonthlyFils ? " / month" : ""}</span></div>
            <ul className="mt-4 flex-1 space-y-2 text-sm">{p.features.map((f) => <li key={f}>— {f}</li>)}</ul>
            <Link href={p.code === "FREE" ? "/signup" : `/contact?topic=general&plan=${p.code}`} className={`mt-6 ${p.code === "FREE" ? "btn-primary" : "btn-secondary"}`}>{p.code === "FREE" ? "Get started" : "Talk to us"}</Link>
          </div>
        ))}
        {!plans.length && <p className="text-muted">Plans are being finalised.</p>}
      </div>

      <section className="mt-16 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="h2">Marketplace fee</h2>
          <p className="mt-3 text-muted">Deducted from the payee's payout on successful paid collaborations only. Free collaborations (like most expert guest appearances) carry no fee. VAT at {vat.ratePct}% applies to our fee.</p>
        </div>
        <div className="card overflow-hidden">
          <table className="table">
            <tbody>
              {([["Podcast sponsorship", "PODCAST_SPONSORSHIP"], ["Influencer campaign", "INFLUENCER_CAMPAIGN"], ["Paid guest appearance", "GUEST_APPEARANCE"], ["UGC production", "UGC_PRODUCTION"], ["Events & ambassadors", "EVENT_APPEARANCE"]] as const).map(([l, k]) => (
                <tr key={k}><td>{l}</td><td className="text-end text-ink">{commission[k]}%</td></tr>
              ))}
              <tr><td>Agency-managed deals</td><td className="text-end text-ink">−{commission.agencyDiscountPct} pts</td></tr>
              <tr><td>Minimum paid deal</td><td className="text-end text-ink">{formatAed(commission.minimumDealFils)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-10 text-xs text-muted">Prices in AED. Plans and fees may change with notice; existing agreements keep the fee shown when they were contracted.</p>
    </div>
  );
}
