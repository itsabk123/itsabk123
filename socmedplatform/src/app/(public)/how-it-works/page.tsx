import Link from "next/link";

export const metadata = { title: "How it works", description: "How brands, podcasts, guests, influencers and agencies collaborate on Majlis — from discovery to payment and results." };

const FLOW = [
  ["1. Create a profile — or several", "One account can run a brand, a podcast, a guest profile and a creator profile. Switch between them from the dashboard. You can explore before finishing your profile; we'll ask for the essentials before you apply or accept bookings."],
  ["2. Discover with explainable matching", "Search by emirate, language, niche, audience size, engagement, price and format. Signed-in users see a match score with the reasons behind it, the concerns, and any missing information. Match scores never use gender, nationality or other sensitive attributes."],
  ["3. Invite, apply or pitch", "Brands invite creators and podcasts. Creators apply to campaigns. Guests pitch hosts; hosts invite guests. Every route opens a proposal with price, deliverables and dates, plus a private conversation."],
  ["4. Negotiate", "Either side can counter. Every version is kept, so both parties can see what changed. When one side accepts the other's latest proposal, terms are locked."],
  ["5. Contract", "We generate a collaboration agreement from the accepted terms — deliverables, usage rights, exclusivity, revisions, disclosure, cancellation and disputes. Both parties accept it electronically. It's a template, not legal advice."],
  ["6. Pay", "For paid deals the payer pays through our payment provider. A payment is only marked as received when the provider confirms it. The money is held by the platform and released to the creator after delivery is approved. This is not a regulated escrow service."],
  ["7. Deliver, approve, publish", "Creators submit drafts and links against each deliverable. The brand approves or requests a revision within the agreed number of rounds."],
  ["8. Measure honestly", "Create tracked links and coupon codes. Clicks on tracked links are counted by the platform; other results are logged with their source — API-verified, creator-reported, advertiser-reported or estimated."],
  ["9. Review & rebook", "Both sides review each other after completion. Reviews are revealed together so nobody can retaliate. Strong partners get suggested for repeat campaigns."],
];

export default function HowItWorks() {
  return (
    <div className="page py-14">
      <div className="eyebrow mb-3">How it works</div>
      <h1 className="h1 max-w-3xl">A complete collaboration workflow — not just a directory.</h1>
      <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {FLOW.map(([t, b]) => (
          <div key={t} className="border-t border-line pt-5">
            <h2 className="h3">{t}</h2>
            <p className="mt-2 text-muted">{b}</p>
          </div>
        ))}
      </div>
      <div className="mt-14 flex flex-wrap gap-2">
        <Link href="/signup" className="btn-primary">Create your free profile</Link>
        <Link href="/legal/disputes" className="btn-secondary">Disputes & refunds</Link>
      </div>
    </div>
  );
}
