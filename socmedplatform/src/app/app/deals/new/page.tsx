import Link from "next/link";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Flash, PageHeader, Avatar, ScoreRing } from "@/components/ui";
import { createDealFromForm } from "../actions";
import { OFFERING_KINDS } from "@/lib/taxonomy";
import { formatAed, toAed } from "@/lib/money";
import { generateSlots, formatDateTime } from "@/lib/time";
import { candidateInclude, contextFromCampaign, contextFromProfile, toCandidate } from "@/lib/match-data";
import { scoreCandidate } from "@/lib/matching";
import { getConfig } from "@/lib/config";
import { defaultPayer } from "@/lib/deal-roles";
import { DraftButton } from "@/components/draft-button";

export default async function NewDeal({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { acting, user } = await requireActing();
  const campaign = sp.campaign ? await db.campaign.findUnique({ where: { id: sp.campaign }, include: { deliverables: true } }) : null;
  const offering = sp.offering ? await db.offering.findUnique({ where: { id: sp.offering } }) : null;
  const toId = campaign?.brandProfileId ?? offering?.profileId ?? sp.to;
  const to = toId ? await db.profile.findUnique({ where: { id: toId }, include: candidateInclude }) : null;
  if (!to) return <div><PageHeader title="Choose who to work with" /><p className="text-muted">Open a profile or campaign and choose "Propose a collaboration".</p><Link href="/discover/podcasts" className="btn-primary mt-4">Discover</Link></div>;
  const weights = await getConfig("matchWeights");
  const me = await db.profile.findUniqueOrThrow({ where: { id: acting.id }, include: candidateInclude });
  const match = campaign ? scoreCandidate(contextFromCampaign(campaign), toCandidate(me), weights) : scoreCandidate(await contextFromProfile(acting), toCandidate(to), weights);
  const payerDefault = defaultPayer(acting, to);
  const isGuestFlow = acting.type === "GUEST" || to.type === "GUEST";
  let slots: { startsAt: Date }[] = [];
  if (offering?.bookable) {
    const [rules, busy] = await Promise.all([
      db.availabilityRule.findMany({ where: { profileId: offering.profileId } }),
      db.booking.findMany({ where: { providerProfileId: offering.profileId, status: { in: ["REQUESTED", "CONFIRMED"] }, endsAt: { gte: new Date() } } }),
    ]);
    slots = generateSlots(rules, busy, { durationMin: offering.durationMin ?? 60, days: 21 }).slice(0, 40);
  }
  const defaultDeliverables = campaign?.deliverables.length
    ? campaign.deliverables.map((d) => `${d.quantity}× ${d.kind}${d.description ? ` (${d.description})` : ""}`).join("\n")
    : offering ? offering.title : isGuestFlow ? "Recorded interview episode" : "";
  const defaultPrice = offering?.priceFils ? toAed(offering.priceFils) : campaign?.budgetMinFils ? toAed(campaign.budgetMinFils) : "";
  const title = campaign ? `Application: ${campaign.name}` : acting.type === "GUEST" && to.type === "PODCAST" ? "Guest pitch" : acting.type === "PODCAST" && to.type === "GUEST" ? "Guest invitation" : "Proposal";
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={title} title={campaign ? campaign.name : `To ${to.displayName}`} sub="Set out what you'll deliver, when and for how much. The other side can accept, counter or decline." />
      <Flash sp={sp} />
      {!user.emailVerifiedAt && <div className="mb-4 rounded-xl border border-warn/30 bg-[#FBF1E2] px-4 py-3 text-sm text-warn">Confirm your email before sending proposals.</div>}
      <div className="card mb-6 flex items-center gap-4 p-4">
        <Avatar src={to.avatarUrl} name={to.displayName} size={44} />
        <div className="min-w-0 flex-1"><div className="font-medium text-ink">{to.displayName}</div><div className="text-xs text-muted">{match.reasons.slice(0, 3).join(" · ") || "Limited data to match on"}</div>{match.concerns.length > 0 && <div className="text-xs text-warn">{match.concerns.join(" · ")}</div>}</div>
        <ScoreRing score={match.score} />
      </div>
      <form action={createDealFromForm} className="card-pad space-y-5">
        <input type="hidden" name="to" value={to.id} />
        <input type="hidden" name="campaign" value={campaign?.id ?? ""} />
        <input type="hidden" name="offering" value={offering?.id ?? ""} />
        <input type="hidden" name="matchScore" value={match.score} />
        {offering && <div className="rounded-xl bg-paper p-3 text-sm">Package: <span className="text-ink">{offering.title}</span> · {OFFERING_KINDS[offering.kind]?.label} · {offering.priceType === "FREE" ? "Free" : formatAed(offering.priceFils)}</div>}
        {!offering && !campaign && (
          <div><label className="label" htmlFor="kind">Collaboration type</label>
            <select id="kind" name="kind" className="input" defaultValue={isGuestFlow ? "GUEST_APPEARANCE" : to.type === "PODCAST" || acting.type === "PODCAST" ? "PODCAST_SPONSORSHIP" : "INFLUENCER_CAMPAIGN"}>
              <option value="PODCAST_SPONSORSHIP">Podcast sponsorship</option><option value="INFLUENCER_CAMPAIGN">Influencer campaign</option><option value="GUEST_APPEARANCE">Guest appearance</option><option value="UGC_PRODUCTION">UGC production</option><option value="EVENT_APPEARANCE">Event appearance</option><option value="AMBASSADOR">Brand ambassadorship</option><option value="OTHER">Other</option>
            </select>
          </div>
        )}
        <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" className="input" defaultValue={campaign ? campaign.name : offering?.title ?? ""} placeholder="e.g. Ramadan launch — 2 reels + 3 stories" /></div>
        <div><label className="label" htmlFor="deliverables">Deliverables</label><textarea id="deliverables" name="deliverables" className="input font-mono text-sm" rows={4} defaultValue={defaultDeliverables} required /><p className="hint">One per line. Add a due date as "— 2026-12-15".</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="price">Price (AED)</label><input id="price" name="price" inputMode="decimal" className="input" defaultValue={defaultPrice} placeholder={isGuestFlow ? "0 for a free appearance" : ""} /></div>
          <div><label className="label" htmlFor="payer">Who pays?</label>
            <select id="payer" name="payer" className="input" defaultValue={payerDefault === acting.id ? "me" : "them"}><option value="me">{acting.displayName} pays</option><option value="them">{to.displayName} pays</option></select>
          </div>
          <div><label className="label" htmlFor="publishDate">Target publish date</label><input id="publishDate" name="publishDate" type="date" className="input" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="revisions">Revision rounds</label><input id="revisions" name="revisions" type="number" min={0} max={5} defaultValue={1} className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="exclusivity">Exclusivity</label><input id="exclusivity" name="exclusivity" className="input" placeholder="e.g. No competing real-estate brands for 30 days" /></div>
        </div>
        <div><label className="label" htmlFor="usageRights">Usage rights</label><input id="usageRights" name="usageRights" className="input" placeholder="e.g. Brand may repost organically for 90 days; paid ads need separate agreement" /></div>
        {slots.length > 0 && (
          <div><label className="label" htmlFor="slot">Preferred time</label>
            <select id="slot" name="slot" className="input"><option value="">Agree later</option>{slots.map((s) => <option key={s.startsAt.toISOString()} value={s.startsAt.toISOString()}>{formatDateTime(s.startsAt, user.timezone)}</option>)}</select>
            <div className="mt-2 flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="mode" value="VIRTUAL" defaultChecked /> Virtual</label><label className="flex items-center gap-2"><input type="radio" name="mode" value="IN_PERSON" /> In person</label></div>
          </div>
        )}
        <div><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" className="input" rows={5} placeholder="Why this is a good fit, and anything they should know." />
          <div className="mt-2"><DraftButton kind="pitch" target="message" extra={{ recipient: to.displayName, why: match.reasons.join(", "), idea: campaign?.name ?? offering?.title ?? "" }} /></div></div>
        <p className="text-xs text-muted">Paid amounts are collected through our payment provider after both sides sign the agreement, and released to the creator when deliverables are approved.</p>
        <div className="flex gap-2"><button className="btn-primary">Send proposal</button><Link href={`/p/${to.slug}`} className="btn-ghost">Cancel</Link></div>
      </form>
    </div>
  );
}
