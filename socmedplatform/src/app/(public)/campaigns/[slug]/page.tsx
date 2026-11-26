import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getActingContext } from "@/lib/access";
import { budgetLabel } from "@/components/campaign-card";
import { Avatar } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { formatNumber } from "@/lib/money";
import { languageLabel, REGULATED_CATEGORIES } from "@/lib/taxonomy";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.campaign.findUnique({ where: { slug }, include: { brand: true } });
  if (!c || c.visibility !== "PUBLIC" || c.status !== "OPEN") return { robots: { index: false } };
  return { title: `${c.name} — ${c.brand.displayName}`, description: `${c.objective} campaign for ${c.creatorTypes.join(", ").toLowerCase()} in ${c.targetEmirates.join(", ") || "the UAE"}.`, alternates: { canonical: `/campaigns/${slug}` } };
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await db.campaign.findUnique({ where: { slug }, include: { brand: true, deliverables: true, _count: { select: { deals: true } } } });
  const ctx = await getActingContext();
  const isOwner = !!ctx?.profiles.some((p) => p.id === c?.brandProfileId);
  if (!c) notFound();
  const visible = isOwner || (c.visibility === "PUBLIC" && ["OPEN", "IN_PROGRESS", "COMPLETED"].includes(c.status));
  if (!visible) notFound();
  const acting = ctx?.acting;
  const eligible = acting && !isOwner && ["PODCAST", "INFLUENCER", "GUEST"].includes(acting.type) && c.creatorTypes.includes(acting.type);
  const existing = acting ? await db.deal.findFirst({ where: { campaignId: c.id, OR: [{ initiatorProfileId: acting.id }, { recipientProfileId: acting.id }] } }) : null;
  const ld = { "@context": "https://schema.org", "@type": "Offer", name: c.name, seller: { "@type": "Organization", name: c.brand.displayName }, areaServed: c.targetEmirates.length ? c.targetEmirates : "United Arab Emirates", priceCurrency: "AED" };
  return (
    <div className="page py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav className="mb-6 text-xs text-muted"><Link href="/campaigns" className="no-underline">Campaigns</Link> / {c.name}</nav>
      {c.isDemo && <div className="mb-6 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">Demonstration campaign with illustrative data.</div>}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <header>
            <Link href={`/p/${c.brand.slug}`} className="flex items-center gap-2 text-sm no-underline"><Avatar src={c.brand.avatarUrl} name={c.brand.displayName} size={28} /> {c.brand.displayName}</Link>
            <h1 className="h1 mt-3 !text-3xl sm:!text-4xl">{c.name}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="badge-gold">{c.objective}</span>
              {c.status !== "OPEN" && <span className="badge">{c.status.replace("_", " ").toLowerCase()}</span>}
              {c.recurring && <span className="badge">Recurring partnership</span>}
              {c.regulatedCategory && <span className="badge-warn">Regulated: {REGULATED_CATEGORIES[c.regulatedCategory]}</span>}
            </div>
          </header>
          {c.product && <section><h2 className="h3 mb-1">Product or service</h2><p>{c.product}</p></section>}
          {c.targetCustomer && <section><h2 className="h3 mb-1">Target customer</h2><p>{c.targetCustomer}</p></section>}
          {c.instructions && <section><h2 className="h3 mb-1">Brief</h2><p className="whitespace-pre-line">{c.instructions}</p></section>}
          {c.deliverables.length > 0 && (
            <section><h2 className="h3 mb-2">Deliverables</h2><ul className="space-y-1">{c.deliverables.map((d) => <li key={d.id}>{d.quantity}× {d.kind}{d.description ? ` — ${d.description}` : ""}</li>)}</ul></section>
          )}
          {c.brandSafety && <section><h2 className="h3 mb-1">Brand safety</h2><p className="text-sm">{c.brandSafety}</p></section>}
          <section className="rounded-2xl bg-paper-deep p-4 text-sm text-muted">All sponsored content must be clearly disclosed as advertising. Creators are responsible for holding any permit required of them; joining the platform is not a permit.</section>
        </div>
        <aside className="card-pad space-y-3 text-sm lg:sticky lg:top-20 lg:self-start">
          <div><div className="stat-label">Budget</div><div className="text-lg text-ink">{budgetLabel(c)}</div></div>
          <div><div className="stat-label">Looking for</div><div>{c.creatorTypes.map((t) => t.toLowerCase()).join(", ")}</div></div>
          <div><div className="stat-label">Where</div><div>{c.targetEmirates.join(", ") || "All UAE"}</div></div>
          {c.languages.length > 0 && <div><div className="stat-label">Languages</div><div>{c.languages.map(languageLabel).join(", ")}</div></div>}
          {(c.ageMin || c.ageMax) && <div><div className="stat-label">Audience age</div><div>{c.ageMin ?? "?"}–{c.ageMax ?? "?"}</div></div>}
          {c.minAudience && <div><div className="stat-label">Min. audience</div><div>{formatNumber(c.minAudience)}</div></div>}
          {c.contentFormats.length > 0 && <div><div className="stat-label">Formats</div><div>{c.contentFormats.join(", ")}</div></div>}
          <div><div className="stat-label">Dates</div><div>{formatDate(c.startDate)} – {formatDate(c.endDate)}</div></div>
          <div className="text-xs text-muted">{c._count.deals} proposal(s) so far</div>
          {isOwner ? <Link href={`/app/campaigns/${c.id}`} className="btn-primary w-full">Manage campaign</Link>
            : existing ? <Link href={`/app/deals/${existing.id}`} className="btn-secondary w-full">View your proposal</Link>
            : eligible && c.status === "OPEN" ? <Link href={`/app/deals/new?campaign=${c.id}`} className="btn-primary w-full">Apply with a proposal</Link>
            : acting ? <p className="text-xs text-muted">This campaign is looking for {c.creatorTypes.join(", ").toLowerCase()} profiles. Switch to an eligible profile to apply.</p>
            : <Link href={`/signup?next=/campaigns/${c.slug}`} className="btn-primary w-full">Join free to apply</Link>}
        </aside>
      </div>
    </div>
  );
}
