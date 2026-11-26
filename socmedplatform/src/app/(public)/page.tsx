import Link from "next/link";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { candidateInclude, engagementOf, reachOf } from "@/lib/match-data";
import { ProfileCard } from "@/components/profile-card";
import { CampaignCard } from "@/components/campaign-card";
import { getActingContext } from "@/lib/access";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const ROLES = [
  { href: "/for/brands", title: "I'm a brand or advertiser", body: "Find podcasts and creators whose audience actually matches your customer, and pay only for agreed deliverables.", cta: "Find creators" },
  { href: "/for/podcast-hosts", title: "I host a podcast", body: "Publish sponsorship packages, get discovered by relevant sponsors, and book credible guests.", cta: "Find sponsors" },
  { href: "/for/guests", title: "I'm an expert or founder", body: "Get booked on podcasts your customers listen to. Free expert, paid or sponsored appearances — your choice.", cta: "Get featured" },
  { href: "/for/influencers", title: "I'm a creator", body: "Show brands your real audience, list your rates, and get paid collaborations — not follower-count contests.", cta: "Find brand deals" },
  { href: "/for/agencies", title: "I run an agency", body: "Manage brands, creators and podcast portfolios with team permissions and consolidated reporting.", cta: "Agency tools" },
];

const STEPS = [
  ["Discover", "Search by emirate, language, niche, audience and budget. Every match shows why it fits — and what's missing."],
  ["Agree", "Send an invitation, application or pitch. Negotiate deliverables and price with tracked counter-offers."],
  ["Contract & pay", "Both parties accept a generated agreement. The payer funds the deal; money is held until delivery is approved."],
  ["Deliver & measure", "Submit content for approval, share tracked links and coupon codes, and log results with their source."],
  ["Review & repeat", "Two-sided reviews after completion. Rebook partners that performed."],
];

export default async function Home() {
  const { d } = await t();
  const ctx = await getActingContext();
  const [creators, campaigns] = await Promise.all([
    db.profile.findMany({
      where: { status: "PUBLISHED", visibility: "PUBLIC", type: { in: ["PODCAST", "INFLUENCER", "GUEST"] } },
      include: candidateInclude,
      orderBy: [{ verifiedAt: { sort: "desc", nulls: "last" } }, { completeness: "desc" }],
      take: 6,
    }),
    db.campaign.findMany({ where: { status: "OPEN", visibility: "PUBLIC" }, include: { brand: true }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    areaServed: { "@type": "Country", name: "United Arab Emirates" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="page pb-16 pt-14 sm:pt-24">
        <div className="eyebrow mb-4">United Arab Emirates · Podcasts · Creators · Brands</div>
        <h1 className="h1 max-w-4xl">{d.heroTitle}</h1>
        <p className="lead mt-6">{d.heroSub}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/discover/influencers" className="btn-primary">{d.findCreators}</Link>
          <Link href="/discover/brands" className="btn-secondary">{d.findSponsors}</Link>
          <Link href="/signup?role=GUEST" className="btn-secondary">{d.beGuest}</Link>
          <Link href="/discover/podcasts?guestBooking=1" className="btn-ghost">{d.findPodcasts} →</Link>
        </div>
      </section>

      <section className="page">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => (
            <Link key={r.href} href={r.href} className="card flex flex-col p-5 no-underline hover:border-ink">
              <div className="h3">{r.title}</div>
              <p className="mt-2 flex-1 text-sm text-muted">{r.body}</p>
              <span className="mt-4 text-sm text-ink">{r.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="page mt-24">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">On the marketplace</div>
            <h2 className="h2">Creators, podcasts & experts</h2>
          </div>
          <Link href="/discover/podcasts" className="btn-ghost btn-sm">Browse all →</Link>
        </div>
        {creators.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((p) => <ProfileCard key={p.id} item={{ profile: p, reach: reachOf(p), er: engagementOf(p), rating: null, match: null, featured: false }} showMatch={false} />)}
          </div>
        ) : (
          <div className="card-pad text-center text-muted">We're onboarding our founding creators now. <Link href="/signup" className="link">Create your free profile</Link> to be among the first.</div>
        )}
      </section>

      <section className="page mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Open opportunities</div>
            <h2 className="h2">Current campaigns</h2>
          </div>
          <Link href="/campaigns" className="btn-ghost btn-sm">All campaigns →</Link>
        </div>
        {campaigns.length ? (
          <div className="grid gap-4 md:grid-cols-3">{campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
        ) : (
          <div className="card-pad text-center text-muted">No public campaigns yet. Brands can <Link href="/signup?role=BRAND" className="link">post the first one</Link>.</div>
        )}
      </section>

      <section className="page mt-24">
        <div className="eyebrow mb-2">How it works</div>
        <h2 className="h2 mb-8">From first search to repeat partnership</h2>
        <ol className="grid gap-6 md:grid-cols-5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="border-t border-ink pt-4">
              <div className="font-serif text-sm text-gold">0{i + 1}</div>
              <div className="h3 mt-1">{title}</div>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="page mt-24 grid gap-10 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Built for trust</div>
          <h2 className="h2">Clear numbers. Clear terms.</h2>
          <p className="mt-4 text-muted">We don't publish vanity stats or invented testimonials. Here is what the product guarantees instead.</p>
        </div>
        <ul className="divide-y divide-line border-y border-line text-sm">
          {[
            ["Every metric shows its source", "Verified via API, self-reported, advertiser-reported or estimated — always labelled."],
            ["Payment released after approval", "Funds are collected up front and released to the creator only when deliverables are approved or a dispute is resolved."],
            ["Reviews only after real work", "Both sides can review only after a completed collaboration, revealed together to prevent retaliation."],
            ["Compliance built in", "Regulated categories get human review. Creators can store advertiser-permit details with expiry reminders."],
            ["Paid placement is labelled", "Featured listings are marked and never mixed into organic match scores."],
          ].map(([a, b]) => (
            <li key={a} className="py-4"><div className="font-medium text-ink">{a}</div><div className="text-muted">{b}</div></li>
          ))}
        </ul>
      </section>

      <section className="page mt-24">
        <div className="rounded-3xl bg-ink px-6 py-12 text-paper sm:px-12">
          <h2 className="font-serif text-2xl text-paper sm:text-4xl">Start with a free profile.</h2>
          <p className="mt-3 max-w-xl text-paper/70">One account, every role. Run a podcast, appear as a guest and take brand deals — without separate logins.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={ctx ? "/app" : "/signup"} className="btn bg-paper text-ink hover:bg-white">{ctx ? "Go to dashboard" : "Join free"}</Link>
            <Link href="/pricing" className="btn border border-paper/30 text-paper hover:border-paper">See pricing</Link>
          </div>
        </div>
      </section>
    </>
  );
}
