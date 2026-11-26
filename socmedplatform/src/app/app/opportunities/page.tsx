import Link from "next/link";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { candidateInclude, toCandidate } from "@/lib/match-data";
import { scoreCandidate } from "@/lib/matching";
import { getConfig } from "@/lib/config";
import { CampaignCard } from "@/components/campaign-card";
import { Empty, PageHeader, ScoreRing } from "@/components/ui";

export default async function Opportunities() {
  const { acting } = await requireActing();
  const weights = await getConfig("matchWeights");
  const me = toCandidate(await db.profile.findUniqueOrThrow({ where: { id: acting.id }, include: candidateInclude }));
  const campaigns = await db.campaign.findMany({ where: { status: "OPEN", visibility: "PUBLIC", creatorTypes: { has: acting.type } }, include: { brand: true }, take: 100, orderBy: { createdAt: "desc" } });
  const ranked = campaigns
    .map((c) => ({ c, s: scoreCandidate({ industry: c.industry, categories: c.categories, topics: [], languages: c.languages, emirates: c.targetEmirates, budgetMinFils: c.budgetMinFils, budgetMaxFils: c.budgetMaxFils, contentFormats: c.contentFormats, wantedKinds: [], minAudience: c.minAudience }, me, weights) }))
    .sort((a, b) => b.s.score - a.s.score);
  const podcasts = acting.type === "GUEST" || acting.type === "INFLUENCER"
    ? await db.profile.findMany({ where: { type: "PODCAST", status: "PUBLISHED", podcast: { guestBookingOpen: true } }, take: 6, orderBy: { lastActiveAt: "desc" } })
    : [];
  return (
    <div>
      <PageHeader title="Opportunities" sub="Open campaigns ranked by how well you fit each brief." />
      {ranked.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ranked.map(({ c, s }) => (
            <div key={c.id} className="relative">
              <CampaignCard c={c} />
              <div className="absolute end-4 top-4"><ScoreRing score={s.score} /></div>
            </div>
          ))}
        </div>
      ) : <Empty title="No open campaigns for your profile type right now" body="Save a search on the Campaigns page to get alerted." action={<Link href="/campaigns" className="btn-secondary">Browse all campaigns</Link>} />}
      {podcasts.length > 0 && (
        <section className="mt-10">
          <h2 className="h3 mb-3">Podcasts booking guests</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{podcasts.map((p) => <li key={p.id} className="card p-4"><Link href={`/p/${p.slug}`} className="link font-medium">{p.displayName}</Link><div className="text-xs text-muted">{p.headline}</div></li>)}</ul>
        </section>
      )}
    </div>
  );
}
