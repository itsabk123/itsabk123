import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { Flash, PageHeader } from "@/components/ui";
import { REGULATED_CATEGORIES } from "@/lib/taxonomy";
import { formatAed, toAed } from "@/lib/money";
import { grantPlan, saveCommission, saveLimits, savePlan, savePromotion, saveWeights } from "../actions";

export default async function Config({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [commission, vat, weights, free, prohibited, features, reviews, plans, promos] = await Promise.all([
    getConfig("commission"), getConfig("vat"), getConfig("matchWeights"), getConfig("freeTier"), getConfig("prohibitedCategories"), getConfig("features"), getConfig("reviews"),
    db.plan.findMany({ orderBy: { sort: "asc" } }), db.promotion.findMany({ orderBy: { startsAt: "desc" } }),
  ]);
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
  const n = (name: string, label: string, value: number | string, hint?: string) => <div><label className="label text-xs" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={value} className="input" inputMode="decimal" />{hint && <p className="hint">{hint}</p>}</div>;
  return (
    <div className="space-y-8">
      <PageHeader title="Pricing & configuration" sub="Every commercial number is configurable. Defaults are placeholders — set real values after UAE pricing research. Changes are audit-logged and apply to new agreements only." />
      <Flash sp={sp} />
      <form action={saveCommission} className="card-pad space-y-4">
        <h2 className="h3">Commission & VAT</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {n("PODCAST_SPONSORSHIP", "Podcast sponsorship %", commission.PODCAST_SPONSORSHIP)}{n("INFLUENCER_CAMPAIGN", "Influencer campaign %", commission.INFLUENCER_CAMPAIGN)}{n("GUEST_APPEARANCE", "Guest booking %", commission.GUEST_APPEARANCE)}{n("UGC_PRODUCTION", "UGC %", commission.UGC_PRODUCTION)}
          {n("EVENT_APPEARANCE", "Events %", commission.EVENT_APPEARANCE)}{n("AMBASSADOR", "Ambassador %", commission.AMBASSADOR)}{n("OTHER", "Other %", commission.OTHER)}{n("agencyDiscountPct", "Agency discount (pts)", commission.agencyDiscountPct)}
          {n("minimumDeal", "Minimum paid deal (AED)", toAed(commission.minimumDealFils))}{n("vatRate", "VAT %", vat.ratePct)}
          <div><label className="label text-xs" htmlFor="trn">Platform TRN</label><input id="trn" name="trn" defaultValue={vat.trn} className="input" /></div>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="vatOnFee" defaultChecked={vat.applyToPlatformFee} /> VAT on platform fee</label>
        </div>
        <button className="btn-primary">Save</button>
      </form>

      <form action={saveWeights} className="card-pad space-y-4">
        <h2 className="h3">Match weights <span className="text-sm text-muted">(sum {totalW}; normalised automatically)</span></h2>
        <div className="grid gap-3 sm:grid-cols-7">{(Object.keys(weights) as (keyof typeof weights)[]).map((k) => n(k, k, weights[k]))}</div>
        <p className="hint">Tune against outcomes on Marketplace health. Sensitive attributes are never inputs.</p>
        <button className="btn-primary">Save weights</button>
      </form>

      <form action={saveLimits} className="card-pad space-y-4">
        <h2 className="h3">Free tier, policy & features</h2>
        <div className="grid gap-3 sm:grid-cols-4">{n("activeCampaigns", "Active campaigns", free.activeCampaigns)}{n("monthlyInvites", "Invites / 30 days", free.monthlyInvites)}{n("monthlyApplications", "Applications / 30 days", free.monthlyApplications)}{n("revealAfterDays", "Review reveal (days)", reviews.revealAfterDays)}</div>
        <div><span className="label">Prohibited categories</span><div className="flex flex-wrap gap-2">{Object.entries(REGULATED_CATEGORIES).map(([k, l]) => <label key={k} className="check"><input type="checkbox" name="prohibited" value={k} defaultChecked={prohibited.includes(k)} />{l}</label>)}</div></div>
        <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="aiAssist" defaultChecked={features.aiAssist} /> Writing assistant</label><label className="flex items-center gap-2"><input type="checkbox" name="featuredListings" defaultChecked={features.featuredListings} /> Featured listings</label></div>
        <button className="btn-primary">Save</button>
      </form>

      <section className="card-pad space-y-4">
        <h2 className="h3">Plans</h2>
        {[...plans, null].map((p) => (
          <form key={p?.id ?? "new"} action={savePlan} className="grid gap-2 border-t border-line pt-4 sm:grid-cols-6">
            <input name="code" defaultValue={p?.code} className="input" placeholder="CODE" required readOnly={!!p} />
            <input name="name" defaultValue={p?.name} className="input" placeholder="Name" required />
            <select name="audience" defaultValue={p?.audience ?? "ALL"} className="input"><option>ALL</option><option>CREATOR</option><option>BRAND</option><option>AGENCY</option></select>
            <input name="priceMonthly" defaultValue={p ? toAed(p.priceMonthlyFils) : ""} className="input" placeholder="AED / month" />
            <input name="priceYearly" defaultValue={p ? toAed(p.priceYearlyFils) : ""} className="input" placeholder="AED / year" />
            <input name="sort" defaultValue={p?.sort ?? 0} className="input" placeholder="Sort" />
            <input name="tagline" defaultValue={p?.tagline ?? ""} className="input sm:col-span-6" placeholder="Tagline" />
            <textarea name="features" defaultValue={p?.features.join("\n")} className="input sm:col-span-5" rows={3} placeholder="One feature per line" />
            <div className="flex flex-col gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> Active</label><button className="btn-secondary btn-sm">{p ? "Save" : "Add plan"}</button></div>
          </form>
        ))}
        <form action={grantPlan} className="flex flex-wrap gap-2 border-t border-line pt-4">
          <input name="email" className="input flex-1" placeholder="User email" required /><select name="planCode" className="input !w-48">{plans.map((p) => <option key={p.id} value={p.code}>{p.name} ({formatAed(p.priceMonthlyFils)})</option>)}</select><input name="until" type="date" className="input !w-44" /><button className="btn-secondary">Grant plan manually</button>
        </form>
        <p className="hint">Self-serve subscription checkout is off until a recurring-billing provider is confirmed. Grant plans manually after invoicing.</p>
      </section>

      <section className="card-pad space-y-4">
        <h2 className="h3">Founding-member promotions</h2>
        {[...promos, null].map((p) => (
          <form key={p?.id ?? "new"} action={savePromotion} className="grid gap-2 border-t border-line pt-4 sm:grid-cols-6">
            <input name="code" defaultValue={p?.code} className="input" placeholder="CODE" required readOnly={!!p} />
            <input name="name" defaultValue={p?.name} className="input sm:col-span-2" placeholder="Name" required />
            <select name="kind" defaultValue={p?.kind ?? "COMMISSION_DISCOUNT_PCT"} className="input"><option value="COMMISSION_DISCOUNT_PCT">Commission discount (pts)</option><option value="FREE_FEATURED_DAYS">Free featured days</option><option value="FREE_VERIFICATION">Free verification</option><option value="FIRST_CAMPAIGN_FREE">First campaign fee-free</option></select>
            <input name="value" defaultValue={p?.value ?? ""} className="input" placeholder="Value" />
            <select name="audience" defaultValue={p?.audience ?? "ALL"} className="input"><option>ALL</option><option>CREATOR</option><option>BRAND</option></select>
            <input name="description" defaultValue={p?.description ?? ""} className="input sm:col-span-3" placeholder="Description" />
            <input name="endsAt" type="date" defaultValue={p?.endsAt?.toISOString().slice(0, 10)} className="input" />
            <input name="maxRedemptions" defaultValue={p?.maxRedemptions ?? ""} className="input" placeholder="Max uses" />
            <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> Active</label><button className="btn-secondary btn-sm">{p ? "Save" : "Add"}</button></div>
            {p && <div className="text-xs text-muted sm:col-span-6">{p.redemptions} redemptions</div>}
          </form>
        ))}
      </section>
    </div>
  );
}
