import Link from "next/link";
import type { ProfileType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { contextFromProfile, findMatches, toCandidate, candidateInclude } from "@/lib/match-data";
import { completenessItems } from "@/lib/completeness";
import { scoreCandidate } from "@/lib/matching";
import { getConfig } from "@/lib/config";
import { Avatar, Empty, Flash, PageHeader, ScoreRing, Stat } from "@/components/ui";
import { CampaignCard } from "@/components/campaign-card";
import { STATUS_LABEL } from "@/lib/deal-machine";
import { formatAed } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { permitState } from "@/lib/compliance";
import { hideMatch } from "./saved/actions";

const RECOMMEND: Record<ProfileType, { types: ProfileType[]; title: string }> = {
  BRAND: { types: ["PODCAST", "INFLUENCER", "GUEST"], title: "Creators and podcasts that fit your brand" },
  AGENCY: { types: ["PODCAST", "INFLUENCER", "GUEST"], title: "Creators for your clients" },
  PODCAST: { types: ["BRAND", "GUEST"], title: "Sponsors and guests for your show" },
  GUEST: { types: ["PODCAST"], title: "Podcasts you could appear on" },
  INFLUENCER: { types: ["BRAND", "PODCAST"], title: "Brands and podcasts for you" },
};

export default async function AppHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { user, acting } = await requireActing();
  const full = await db.profile.findUniqueOrThrow({ where: { id: acting.id }, include: { podcast: true, guest: true, influencer: true, brand: true, socialAccounts: true, offerings: { where: { isActive: true } }, audience: true } });
  const checklist = completenessItems(full);
  const todo = checklist.filter((i) => !i.done);
  const rec = RECOMMEND[acting.type];
  const isCreator = ["PODCAST", "INFLUENCER", "GUEST"].includes(acting.type);
  const [matches, needsReply, active, upcoming, payoutsEligible, campaigns] = await Promise.all([
    findMatches({ ctx: await contextFromProfile(acting), types: rec.types, excludeProfileIds: [acting.id], feedbackSourceId: acting.id, limit: 6 }),
    db.deal.findMany({ where: { recipientProfileId: acting.id, status: "PROPOSED" }, include: { initiator: true }, take: 5, orderBy: { createdAt: "desc" } }),
    db.deal.findMany({ where: { OR: [{ initiatorProfileId: acting.id }, { recipientProfileId: acting.id }], status: { in: ["NEGOTIATING", "AGREED", "CONTRACTED", "FUNDED", "IN_PROGRESS", "DELIVERED", "DISPUTED"] } }, include: { initiator: true, recipient: true }, take: 8, orderBy: { updatedAt: "desc" } }),
    db.booking.findMany({ where: { OR: [{ providerProfileId: acting.id }, { requesterProfileId: acting.id }], status: "CONFIRMED", startsAt: { gte: new Date() } }, include: { provider: true, requester: true }, orderBy: { startsAt: "asc" }, take: 3 }),
    db.payout.aggregate({ where: { payeeProfileId: acting.id, status: { in: ["HELD", "ELIGIBLE"] } }, _sum: { amountFils: true } }),
    isCreator ? db.campaign.findMany({ where: { status: "OPEN", visibility: "PUBLIC", creatorTypes: { has: acting.type }, deals: { none: { OR: [{ initiatorProfileId: acting.id }, { recipientProfileId: acting.id }] } } }, include: { brand: true }, take: 30, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  // Rank open campaigns for creators by how well *this creator* fits each brief.
  const weights = await getConfig("matchWeights");
  const meCand = isCreator ? toCandidate(await db.profile.findUniqueOrThrow({ where: { id: acting.id }, include: candidateInclude })) : null;
  const rankedCampaigns = meCand
    ? campaigns
        .map((c) => ({ c, s: scoreCandidate({ industry: c.industry, categories: c.categories, topics: [], languages: c.languages, emirates: c.targetEmirates, budgetMinFils: c.budgetMinFils, budgetMaxFils: c.budgetMaxFils, contentFormats: c.contentFormats, wantedKinds: [], minAudience: c.minAudience }, meCand, weights) }))
        .sort((a, b) => b.s.score - a.s.score)
        .slice(0, 3)
    : [];
  const permit = acting.type === "INFLUENCER" ? permitState(full.influencer?.advertiserPermitNo, full.influencer?.permitExpiresAt) : null;

  return (
    <div>
      <PageHeader eyebrow={`Acting as ${acting.displayName}`} title={`Welcome back, ${user.name.split(" ")[0]}`} actions={
        acting.type === "BRAND" || acting.type === "AGENCY" ? <><Link href="/app/campaigns/new" className="btn-primary">New campaign</Link><Link href="/discover/podcasts" className="btn-secondary">Discover</Link></>
        : acting.type === "GUEST" ? <Link href="/discover/podcasts?guestBooking=1" className="btn-primary">Find podcasts to pitch</Link>
        : <Link href="/campaigns" className="btn-primary">Browse campaigns</Link>
      } />
      <Flash sp={sp} />

      {acting.status !== "PUBLISHED" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-4">
          <div><div className="h3">Your profile isn't published yet</div><p className="text-sm text-muted">Publish to appear in search and to apply or accept bookings.</p></div>
          <Link href={`/app/profiles/${acting.id}/edit`} className="btn-primary btn-sm">Finish & publish</Link>
        </div>
      )}
      {permit && permit.state !== "ok" && <div className="mb-6 rounded-xl border border-warn/30 bg-[#FBF1E2] px-4 py-3 text-sm text-warn">{permit.label}. Some brands require a valid permit — <Link href={`/app/profiles/${acting.id}/edit`} className="underline">update it</Link>.</div>}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Needs your reply" value={needsReply.length} note={<Link href="/app/deals?tab=incoming" className="link">Open</Link>} />
        <Stat label="Active deals" value={active.length} />
        <Stat label="Profile strength" value={`${Math.round(((checklist.length - todo.length) / checklist.length) * 100)}%`} />
        <Stat label={isCreator ? "Pending payouts" : "Upcoming bookings"} value={isCreator ? formatAed(payoutsEligible._sum.amountFils ?? 0) : upcoming.length} note={isCreator ? "Released after approval" : undefined} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-10">
          {needsReply.length > 0 && (
            <section>
              <h2 className="h3 mb-3">Waiting on you</h2>
              <div className="space-y-2">{needsReply.map((d) => (
                <Link key={d.id} href={`/app/deals/${d.id}`} className="card flex items-center gap-3 p-4 no-underline hover:border-ink">
                  <Avatar src={d.initiator.avatarUrl} name={d.initiator.displayName} size={36} />
                  <div className="min-w-0 flex-1"><div className="font-medium text-ink">{d.title}</div><div className="text-xs text-muted">{d.initiator.displayName} · {d.origin.replace("_", " ").toLowerCase()}</div></div>
                  <span className="btn-secondary btn-sm">Respond</span>
                </Link>
              ))}</div>
            </section>
          )}

          {rankedCampaigns.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between"><h2 className="h3">Campaigns that fit you</h2><Link href="/app/opportunities" className="text-sm link">All opportunities</Link></div>
              <div className="grid gap-3 md:grid-cols-3">{rankedCampaigns.map(({ c }) => <CampaignCard key={c.id} c={c} />)}</div>
            </section>
          )}

          <section>
            <h2 className="h3 mb-3">{rec.title}</h2>
            {matches.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {matches.map(({ result, profile }) => (
                  <div key={profile.id} className="card flex gap-3 p-4">
                    <Avatar src={profile.avatarUrl} name={profile.displayName} size={44} />
                    <div className="min-w-0 flex-1 text-sm">
                      <Link href={`/p/${profile.slug}`} className="link font-medium">{profile.displayName}</Link>{profile.isDemo && <span className="badge-warn ms-2">Demo</span>}
                      <div className="text-xs text-muted">{profile.type.toLowerCase()} · {profile.emirate ?? "UAE"}</div>
                      <div className="mt-1 text-xs">{result.reasons.slice(0, 2).join(" · ") || "Limited data"}</div>
                      <div className="mt-2 flex gap-2">
                        <Link href={`/app/deals/new?to=${profile.id}`} className="btn-secondary btn-sm">{acting.type === "GUEST" ? "Pitch" : "Propose"}</Link>
                        <form action={hideMatch}><input type="hidden" name="target" value={profile.id} /><button className="btn-ghost btn-sm">Not relevant</button></form>
                      </div>
                    </div>
                    <ScoreRing score={result.score} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No recommendations yet" body={todo.length ? "Complete your profile so we can match you — industry, emirate and languages matter most." : "Supply in your niche is still growing. We'll alert you as new profiles join."} action={<Link href="/contact?topic=matchmaking" className="btn-secondary">Ask for assisted matchmaking</Link>} />
            )}
          </section>

          {active.length > 0 && (
            <section>
              <h2 className="h3 mb-3">In progress</h2>
              <div className="card divide-y divide-line">{active.map((d) => (
                <Link key={d.id} href={`/app/deals/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm no-underline hover:bg-paper">
                  <span className="truncate text-ink">{d.title} <span className="text-muted">· {(d.initiatorProfileId === acting.id ? d.recipient : d.initiator).displayName}</span></span>
                  <span className="badge shrink-0">{STATUS_LABEL[d.status]}</span>
                </Link>
              ))}</div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {todo.length > 0 && (
            <div className="card-pad">
              <div className="h3 mb-2">Get more matches</div>
              <ul className="space-y-2 text-sm">{todo.slice(0, 6).map((i) => <li key={i.key}><Link href={i.href} className="link">{i.label}</Link></li>)}</ul>
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="card-pad text-sm">
              <div className="h3 mb-2">Upcoming</div>
              {upcoming.map((b) => <div key={b.id} className="mb-2">{formatDateTime(b.startsAt, user.timezone)}<div className="text-xs text-muted">with {(b.providerProfileId === acting.id ? b.requester : b.provider).displayName}</div></div>)}
              <Link href="/app/bookings" className="link text-xs">All bookings</Link>
            </div>
          )}
          <div className="card-pad text-sm">
            <div className="h3 mb-1">Invite partners</div>
            <p className="text-muted">Bring people you already work with. Referral rewards apply when they complete their first collaboration — not just for signing up.</p>
            <code className="mt-2 block break-all rounded-lg bg-paper p-2 text-xs">{(process.env.APP_URL ?? "") + `/signup?ref=${user.referralCode}`}</code>
          </div>
        </aside>
      </div>
    </div>
  );
}
