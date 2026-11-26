import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getActingContext } from "@/lib/access";
import { candidateInclude, contextFromProfile, reachOf, toCandidate } from "@/lib/match-data";
import { scoreCandidate } from "@/lib/matching";
import { getConfig } from "@/lib/config";
import { Avatar, ScoreRing, SourceTag } from "@/components/ui";
import { formatAed, formatNumber } from "@/lib/money";
import { GUEST_APPEARANCE_TYPES, OFFERING_KINDS, PROFILE_TYPE_META, languageLabel, platformLabel } from "@/lib/taxonomy";
import { permitState } from "@/lib/compliance";
import { formatDate, WEEKDAYS, minutesToHHMM } from "@/lib/time";
import { toggleSave, reportTarget, hideMatch } from "@/app/app/saved/actions";
import { startConversation } from "@/app/app/messages/actions";

async function load(slug: string) {
  return db.profile.findUnique({
    where: { slug },
    include: {
      ...candidateInclude,
      agency: true,
      organization: true,
      managedByOrg: true,
      availability: true,
      reviewsReceived: { where: { state: "PUBLISHED" }, include: { author: { select: { displayName: true, slug: true, type: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
      campaigns: { where: { status: "OPEN", visibility: "PUBLIC" }, take: 5 },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await db.profile.findUnique({ where: { slug }, select: { displayName: true, headline: true, bio: true, type: true, indexable: true, status: true, visibility: true, avatarUrl: true, emirate: true } });
  if (!p || p.status !== "PUBLISHED") return { robots: { index: false } };
  const title = `${p.displayName} — ${PROFILE_TYPE_META[p.type].label}${p.emirate ? ` in ${p.emirate}` : " in the UAE"}`;
  return {
    title,
    description: (p.headline ?? p.bio ?? "").slice(0, 160),
    alternates: { canonical: `/p/${slug}` },
    robots: { index: p.indexable && p.visibility === "PUBLIC", follow: true },
    openGraph: { title, images: p.avatarUrl ? [p.avatarUrl] : undefined },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  const ctx = await getActingContext();
  const isMine = !!ctx?.profiles.some((x) => x.id === p?.id);
  if (!p || p.status === "SUSPENDED" || (p.status !== "PUBLISHED" && !isMine) || (p.visibility === "PRIVATE" && !isMine)) notFound();
  if (p.visibility === "MEMBERS" && !ctx?.user) {
    return (
      <div className="page py-20 text-center">
        <h1 className="h2">{p.displayName}</h1>
        <p className="mt-2 text-muted">This profile is visible to signed-in members only.</p>
        <Link href={`/login?next=/p/${slug}`} className="btn-primary mt-6">Log in to view</Link>
      </div>
    );
  }
  const acting = ctx?.acting ?? null;
  if (!isMine && p.status === "PUBLISHED") await db.analyticsEvent.create({ data: { name: "profile_view", userId: ctx?.user.id ?? null, props: { profileId: p.id } } });
  const weights = await getConfig("matchWeights");
  const match = acting && !isMine ? scoreCandidate(await contextFromProfile(acting), toCandidate(p), weights) : null;
  const saved = ctx?.user ? await db.savedProfile.findFirst({ where: { userId: ctx.user.id, profileId: p.id } }) : null;
  const ratings = p.reviewsReceived.map((r) => r.rating);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const completed = p._count.dealsInitiated + p._count.dealsReceived;
  const reach = reachOf(p);
  const permit = p.type === "INFLUENCER" ? permitState(p.influencer?.advertiserPermitNo, p.influencer?.permitExpiresAt) : null;
  const meta = PROFILE_TYPE_META[p.type];
  const links = (p.links ?? {}) as Record<string, string>;
  const ld = {
    "@context": "https://schema.org",
    "@type": p.type === "BRAND" || p.type === "AGENCY" ? "Organization" : p.type === "PODCAST" ? "PodcastSeries" : "Person",
    name: p.displayName,
    description: p.headline ?? undefined,
    url: `/p/${p.slug}`,
    ...(p.type === "PODCAST" ? { webFeed: p.podcast?.spotifyUrl ?? undefined } : {}),
    ...(avg && ratings.length >= 3 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: ratings.length } } : {}),
  };
  const canPropose = acting && !isMine;
  const proposeHref = `/app/deals/new?to=${p.id}`;

  return (
    <div className="page py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted">
        <Link href="/" className="no-underline">Home</Link> / <Link href={`/discover/${meta.path}`} className="no-underline">{meta.plural}</Link> / {p.displayName}
      </nav>
      {p.status !== "PUBLISHED" && <div className="mb-6 rounded-xl border border-warn/30 bg-[#FBF1E2] px-4 py-3 text-sm text-warn">Preview — this profile is not published yet. <Link href={`/app/profiles/${p.id}/edit`} className="underline">Edit & publish</Link></div>}
      {p.isDemo && <div className="mb-6 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">This is a demonstration profile with illustrative data. It is not a real creator.</div>}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar src={p.avatarUrl} name={p.displayName} size={96} />
            <div className="min-w-0 flex-1">
              <div className="eyebrow">{meta.label}{p.managedByOrg ? ` · Represented by ${p.managedByOrg.name}` : ""}</div>
              <h1 className="h1 mt-1 !text-3xl sm:!text-4xl">{p.displayName}{p.verifiedAt && <span className="ms-2 align-middle text-base text-accent" title={`Verified ${formatDate(p.verifiedAt)}`}>✓ Verified</span>}</h1>
              {p.type === "GUEST" && <div className="mt-1 text-muted">{[p.guest?.professionalTitle, p.guest?.company].filter(Boolean).join(" at ")}</div>}
              {p.headline && <p className="mt-2 text-lg text-charcoal">{p.headline}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {(p.city || p.emirate) && <span className="badge">{[p.city, p.emirate].filter(Boolean).join(", ")}</span>}
                {p.languages.map((l) => <span key={l} className="badge">{languageLabel(l)}</span>)}
                {p.industry && <span className="badge">{p.industry}</span>}
                {p.niches.map((n) => <span key={n} className="badge">{n}</span>)}
              </div>
            </div>
          </header>

          {p.bio && <section><h2 className="h3 mb-2">About</h2><p className="whitespace-pre-line text-charcoal">{p.bio}</p></section>}

          {p.type === "PODCAST" && p.podcast && (
            <section className="grid gap-3 sm:grid-cols-4">
              {[
                ["Format", p.podcast.format === "BOTH" ? "Audio + video" : p.podcast.format === "VIDEO" ? "Video" : "Audio"],
                ["Frequency", p.podcast.frequency ?? "—"],
                ["Episodes", p.podcast.episodeCount ?? "—"],
                ["Avg. length", p.podcast.avgDurationMin ? `${p.podcast.avgDurationMin} min` : "—"],
              ].map(([k, v]) => <div key={String(k)} className="card p-4"><div className="stat-label">{k}</div><div className="mt-1 text-ink">{v}</div></div>)}
              <div className="flex flex-wrap gap-2 sm:col-span-4">
                {p.podcast.spotifyUrl && <a href={p.podcast.spotifyUrl} rel="nofollow noopener" target="_blank" className="btn-secondary btn-sm">Spotify</a>}
                {p.podcast.appleUrl && <a href={p.podcast.appleUrl} rel="nofollow noopener" target="_blank" className="btn-secondary btn-sm">Apple Podcasts</a>}
                {p.podcast.youtubeUrl && <a href={p.podcast.youtubeUrl} rel="nofollow noopener" target="_blank" className="btn-secondary btn-sm">YouTube</a>}
                {p.podcast.guestBookingOpen && <span className="badge-accent">Currently booking guests</span>}
              </div>
              {p.podcast.guestRequirements && <p className="text-sm text-muted sm:col-span-4"><span className="text-ink">Guest requirements:</span> {p.podcast.guestRequirements}</p>}
            </section>
          )}

          {p.type === "GUEST" && p.guest && (
            <section className="space-y-4">
              {p.guest.topics.length > 0 && <div><h2 className="h3 mb-2">Topics</h2><div className="flex flex-wrap gap-1.5">{p.guest.topics.map((t) => <span key={t} className="badge">{t}</span>)}</div></div>}
              {p.guest.excludedTopics.length > 0 && <div className="text-sm text-muted">Prefers not to discuss: {p.guest.excludedTopics.join(", ")}</div>}
              <div><h2 className="h3 mb-2">Available for</h2><div className="flex flex-wrap gap-1.5">{p.guest.appearanceTypes.map((t) => <span key={t} className="badge-gold">{GUEST_APPEARANCE_TYPES[t] ?? t}</span>)}</div>
                <p className="mt-2 text-sm text-muted">{p.guest.virtualAvailable ? "Remote recording OK. " : ""}{p.guest.willingToTravel ? "Willing to travel within the UAE." : ""}</p>
              </div>
              {p.guest.introVideoUrl && <a href={p.guest.introVideoUrl} target="_blank" rel="nofollow noopener" className="link text-sm">Watch intro video →</a>}
            </section>
          )}

          {(p.socialAccounts.length > 0 || p.metrics.length > 0) && (
            <section id="audience">
              <h2 className="h3 mb-3">Audience</h2>
              <div className="card overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Channel</th><th>Audience</th><th>Avg. views</th><th>Engagement</th><th>Source</th></tr></thead>
                  <tbody>
                    {p.socialAccounts.map((s) => (
                      <tr key={s.id}>
                        <td>{s.url ? <a href={s.url} rel="nofollow noopener" target="_blank" className="link">{platformLabel[s.platform] ?? s.platform}</a> : platformLabel[s.platform] ?? s.platform} <span className="text-muted">@{s.handle}</span></td>
                        <td>{formatNumber(s.followers)}</td>
                        <td>{formatNumber(s.avgViews)}</td>
                        <td>{s.engagementRate !== null ? `${s.engagementRate}%` : "—"}</td>
                        <td><SourceTag source={s.source} />{s.verifiedAt && <div className="mt-1 text-xs text-muted">Checked {formatDate(s.verifiedAt)}</div>}</td>
                      </tr>
                    ))}
                    {p.metrics.map((m) => (
                      <tr key={m.id}><td>{m.key.replaceAll("_", " ")}</td><td>{formatNumber(m.value)}</td><td>—</td><td>—</td><td><SourceTag source={m.source} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {p.audience.length > 0 && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {["GEO", "AGE", "INTEREST"].map((dim) => {
                    const rows = p.audience.filter((a) => a.dimension === dim).sort((a, b) => b.share - a.share);
                    if (!rows.length) return null;
                    return (
                      <div key={dim} className="card p-4">
                        <div className="stat-label mb-2">{dim === "GEO" ? "Where" : dim === "AGE" ? "Age" : "Interests"}</div>
                        {rows.slice(0, 5).map((r) => (
                          <div key={r.id} className="mb-2 text-sm">
                            <div className="flex justify-between"><span>{r.bucket}</span><span className="text-muted">{r.share}%</span></div>
                            <div className="mt-1 h-1.5 rounded-full bg-paper-deep"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${Math.min(100, r.share)}%` }} /></div>
                          </div>
                        ))}
                        <SourceTag source={rows[0].source} />
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-xs text-muted">Figures marked self-reported have not been independently verified. Ask for screenshots or a connected account before booking.</p>
            </section>
          )}

          {p.offerings.length > 0 && (
            <section id="offerings">
              <h2 className="h3 mb-3">{p.type === "BRAND" ? "Programmes" : "Packages & rates"}</h2>
              <div className="grid gap-3">
                {p.offerings.map((o) => {
                  const soldOut = o.inventoryTotal !== null && o.inventoryUsed >= o.inventoryTotal;
                  return (
                    <div key={o.id} className="card flex flex-wrap items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink">{o.title}</div>
                        <div className="text-sm text-muted">{OFFERING_KINDS[o.kind]?.label ?? o.kind}{o.deliveryDays ? ` · delivered within ${o.deliveryDays} days` : ""}{o.bookable ? ` · ${o.durationMin ?? 60}-min booking` : ""}{o.inventoryTotal !== null ? ` · ${Math.max(0, o.inventoryTotal - o.inventoryUsed)} of ${o.inventoryTotal} available` : ""}</div>
                        {o.description && <p className="mt-1 text-sm text-charcoal">{o.description}</p>}
                      </div>
                      <div className="text-end">
                        <div className="text-ink">{o.priceType === "FREE" ? "Free" : o.priceType === "ON_REQUEST" ? "On request" : `${o.priceType === "FROM" ? "from " : ""}${formatAed(o.priceFils)}`}</div>
                        {canPropose && !soldOut && <Link href={`${proposeHref}&offering=${o.id}`} className="btn-primary btn-sm mt-2">Request</Link>}
                        {soldOut && <span className="badge mt-2">Fully booked</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {p.availability.length > 0 && (
            <section>
              <h2 className="h3 mb-2">Usual availability</h2>
              <ul className="text-sm text-muted">{p.availability.map((a) => <li key={a.id}>{WEEKDAYS[a.weekday]} {minutesToHHMM(a.startMinute)}–{minutesToHHMM(a.endMinute)} ({a.timezone === "Asia/Dubai" ? "UAE time" : a.timezone})</li>)}</ul>
            </section>
          )}

          {p.campaigns.length > 0 && (
            <section>
              <h2 className="h3 mb-2">Open campaigns</h2>
              <ul className="space-y-2">{p.campaigns.map((c) => <li key={c.id}><Link href={`/campaigns/${c.slug}`} className="link">{c.name}</Link> <span className="text-sm text-muted">· {c.objective}</span></li>)}</ul>
            </section>
          )}

          <section>
            <h2 className="h3 mb-3">Reviews</h2>
            {p.reviewsReceived.length ? (
              <div className="space-y-3">
                {p.reviewsReceived.map((r) => (
                  <div key={r.id} className="card p-4">
                    <div className="flex justify-between text-sm"><Link href={`/p/${r.author.slug}`} className="link">{r.author.displayName}</Link><span className="text-gold">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></span></div>
                    {r.body && <p className="mt-2 text-sm">{r.body}</p>}
                    <div className="mt-1 text-xs text-muted">Verified collaboration · {formatDate(r.createdAt)}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No reviews yet. Reviews can only be left after a completed collaboration on {"the platform"}.</p>}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {match && (
            <div className="card-pad">
              <div className="flex items-center gap-3"><ScoreRing score={match.score} /><div><div className="h3">Match for {acting?.displayName}</div><div className="text-xs text-muted">Confidence: {match.confidence}</div></div></div>
              {match.reasons.length > 0 && <div className="mt-4"><div className="stat-label mb-1">Strengths</div><ul className="space-y-1 text-sm">{match.reasons.map((r) => <li key={r}>+ {r}</li>)}</ul></div>}
              {match.concerns.length > 0 && <div className="mt-3"><div className="stat-label mb-1">Watch-outs</div><ul className="space-y-1 text-sm text-warn">{match.concerns.map((r) => <li key={r}>– {r}</li>)}</ul></div>}
              {match.missing.length > 0 && <div className="mt-3 text-xs text-muted">Missing info: {match.missing.join(", ")}</div>}
              {match.suggestedFormat && <div className="mt-3 text-xs text-muted">Suggested format: {OFFERING_KINDS[match.suggestedFormat]?.label ?? match.suggestedFormat}</div>}
              <form action={hideMatch} className="mt-3"><input type="hidden" name="target" value={p.id} /><button className="text-xs text-muted underline">Not relevant — hide from my recommendations</button></form>
            </div>
          )}
          <div className="card-pad space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="font-serif text-xl text-ink">{reach ? formatNumber(reach) : "—"}</div><div className="text-xs text-muted">Audience</div></div>
              <div><div className="font-serif text-xl text-ink">{completed}</div><div className="text-xs text-muted">Completed</div></div>
              <div><div className="font-serif text-xl text-ink">{avg ? avg.toFixed(1) : "—"}</div><div className="text-xs text-muted">{ratings.length} review{ratings.length === 1 ? "" : "s"}</div></div>
            </div>
            {isMine ? (
              <Link href={`/app/profiles/${p.id}/edit`} className="btn-primary w-full">Edit profile</Link>
            ) : canPropose ? (
              <>
                <Link href={proposeHref} className="btn-primary w-full">
                  {acting!.type === "GUEST" && p.type === "PODCAST" ? "Pitch myself as a guest" : acting!.type === "PODCAST" && p.type === "GUEST" ? "Invite to my podcast" : acting!.type === "PODCAST" && p.type === "BRAND" ? "Propose a sponsorship" : "Propose a collaboration"}
                </Link>
                <form action={startConversation}><input type="hidden" name="to" value={p.id} /><button className="btn-secondary w-full">Send a message</button></form>
                <form action={toggleSave}><input type="hidden" name="profileId" value={p.id} /><input type="hidden" name="back" value={`/p/${p.slug}`} /><button className="btn-ghost w-full">{saved ? "Saved ✓ — remove" : "Save to shortlist"}</button></form>
              </>
            ) : (
              <Link href={`/signup?next=/p/${p.slug}`} className="btn-primary w-full">Join free to contact</Link>
            )}
            {p.showContact && p.contactEmail && ctx?.user && <div className="text-xs text-muted">Business contact: <a className="link" href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a></div>}
          </div>
          <div className="card-pad space-y-2 text-sm">
            <div className="stat-label">Trust</div>
            <div>{p.verifiedAt ? `✓ Identity/business verified ${formatDate(p.verifiedAt)}` : "Not yet verified"}</div>
            {p.socialAccounts.some((s) => s.source === "API_VERIFIED") ? <div>✓ Some audience data verified via API</div> : <div className="text-muted">Audience data self-reported</div>}
            {permit && <div className={permit.state === "ok" ? "" : "text-warn"}>{permit.label}{p.influencer?.advertiserPermitNo && permit.state !== "missing" ? <span className="block text-xs text-muted">UAE Media Council permit no. {p.influencer.advertiserPermitNo}</span> : null}</div>}
            <div className="text-muted">Member since {formatDate(p.createdAt)} · active {formatDate(p.lastActiveAt)}</div>
            {p.website && <a href={p.website} rel="nofollow noopener" target="_blank" className="link block">Website</a>}
            {Object.entries(links).filter(([, v]) => v).map(([k, v]) => <a key={k} href={v} rel="nofollow noopener" target="_blank" className="link block capitalize">{k}</a>)}
          </div>
          {ctx?.user && !isMine && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Report this profile</summary>
              <form action={reportTarget} className="mt-2 space-y-2">
                <input type="hidden" name="targetType" value="PROFILE" /><input type="hidden" name="targetId" value={p.id} /><input type="hidden" name="back" value={`/p/${p.slug}`} />
                <select name="reason" className="input" required><option value="">Reason…</option><option>Fake or misleading audience</option><option>Impersonation</option><option>Inappropriate content</option><option>Spam or scam</option><option>Other</option></select>
                <textarea name="details" className="input" placeholder="Details (optional)" />
                <button className="btn-secondary btn-sm">Submit report</button>
              </form>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
