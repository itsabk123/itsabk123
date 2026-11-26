import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const ROLES: Record<string, { eyebrow: string; title: string; sub: string; signup: string; points: [string, string][]; cta: [string, string][] }> = {
  brands: {
    eyebrow: "For brands & advertisers",
    title: "Reach UAE audiences through voices they already trust.",
    sub: "Find podcasts, creators and expert guests whose audiences match your customer — by emirate, language and interest — then run the whole collaboration in one place.",
    signup: "BRAND",
    points: [
      ["Campaign wizard", "Set objective, audience, emirates, languages, budget, formats and deliverables. Publish publicly or keep it private and invite only."],
      ["Explainable recommendations", "See why each creator fits, the watch-outs and what data is missing — before you spend."],
      ["Book your executives as guests", "Find business podcasts for thought-leadership and launch interviews."],
      ["Pay against delivery", "Fund the deal up front; creators are paid after you approve the work."],
      ["Results with sources", "Tracked links, coupon codes and logged results — always labelled by source."],
      ["Team access", "Invite colleagues with owner, admin, manager, member or viewer roles."],
    ],
    cta: [["/signup?role=BRAND", "Create a brand account"], ["/discover/podcasts", "Browse podcasts"]],
  },
  "podcast-hosts": {
    eyebrow: "For podcast hosts & studios",
    title: "Turn your show into a sponsorship business.",
    sub: "Publish your inventory — pre-roll to sponsored series — get discovered by relevant brands, and book credible guests.",
    signup: "PODCAST",
    points: [
      ["Sponsorship packages", "List pre/mid/post-rolls, host reads, sponsored episodes, branded segments, video and social clips with prices and inventory limits."],
      ["Sponsor discovery", "Browse brands and open campaigns that match your listeners."],
      ["Guest booking", "Open guest booking, set availability, and receive pitches from founders and experts."],
      ["Media kit", "Your public profile doubles as a shareable media kit, with metric sources clearly shown."],
      ["Get paid reliably", "Sponsor payments are collected before you record and released when the brand approves."],
      ["Multiple shows", "Run several podcasts from one account, or as a studio organization."],
    ],
    cta: [["/signup?role=PODCAST", "List your podcast free"], ["/discover/brands", "See brands"]],
  },
  guests: {
    eyebrow: "For podcast guests & experts",
    title: "Get booked on the podcasts your customers listen to.",
    sub: "A professional guest profile with your topics, appearance preferences and availability — then pitch hosts directly.",
    signup: "GUEST",
    points: [
      ["Your terms", "Free expert appearances, paid appearances, sponsored interviews or panels — you choose what you're open to."],
      ["Topics in and out", "List what you speak about and what you won't discuss."],
      ["Pitch multiple hosts", "Send tailored pitches to podcasts that are actively booking guests."],
      ["Opportunity alerts", "Save searches and get alerted when relevant shows open guest booking."],
      ["Shareable profile", "A clean page with your bio, intro video and past appearances."],
      ["Also a creator?", "Add an influencer profile to the same account and take brand deals too."],
    ],
    cta: [["/signup?role=GUEST", "Create a guest profile"], ["/discover/podcasts?guestBooking=1", "Podcasts booking guests"]],
  },
  influencers: {
    eyebrow: "For creators & influencers",
    title: "Get chosen for fit, not follower count.",
    sub: "Show your real audience — where they are, what they care about, which languages you create in — and list your rates.",
    signup: "INFLUENCER",
    points: [
      ["Every format", "Posts, stories, reels, TikToks, YouTube integrations, LinkedIn posts, UGC, events and ambassadorships."],
      ["Honest metrics", "Self-reported figures are labelled as such; verification raises your trust signals."],
      ["Permit details", "Store your advertiser permit number and expiry; we remind you before it lapses."],
      ["Apply to campaigns", "Apply with a proposal, negotiate and get a contract in one thread."],
      ["Guaranteed payment flow", "Brands fund the deal before you start."],
      ["Agency managed?", "Your agency can manage your profile and deals with permission."],
    ],
    cta: [["/signup?role=INFLUENCER", "Create a creator profile"], ["/campaigns", "Browse campaigns"]],
  },
  agencies: {
    eyebrow: "For agencies",
    title: "Run every client and creator from one workspace.",
    sub: "Advertising, talent and podcast-production agencies can manage brands, creators and shows with clear separation between the company, its staff and the talent it represents.",
    signup: "AGENCY",
    points: [
      ["Multiple brands", "Create brand profiles under your organization and run campaigns for each."],
      ["Talent roster", "Manage creator and podcast profiles you represent, with their consent."],
      ["Roles & permissions", "Owner, admin, manager, member and viewer roles."],
      ["Negotiate on behalf of clients", "All actions are logged against the staff member who took them."],
      ["Consolidated reporting", "See spend, deals and results across clients."],
      ["Agency pricing", "Reduced commission on agency-managed deals (configurable)."],
    ],
    cta: [["/signup?role=AGENCY", "Create an agency account"], ["/pricing", "Agency plan"]],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const r = ROLES[(await params).role];
  return r ? { title: r.eyebrow, description: r.sub } : {};
}

export default async function ForRole({ params }: { params: Promise<{ role: string }> }) {
  const r = ROLES[(await params).role];
  if (!r) notFound();
  return (
    <div className="page py-14">
      <div className="eyebrow mb-3">{r.eyebrow}</div>
      <h1 className="h1 max-w-3xl">{r.title}</h1>
      <p className="lead mt-5">{r.sub}</p>
      <div className="mt-8 flex flex-wrap gap-2">
        {r.cta.map(([href, label], i) => <Link key={href} href={href} className={i === 0 ? "btn-primary" : "btn-secondary"}>{label}</Link>)}
      </div>
      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {r.points.map(([t, b]) => (
          <div key={t} className="bg-white p-6"><div className="h3">{t}</div><p className="mt-2 text-sm text-muted">{b}</p></div>
        ))}
      </div>
    </div>
  );
}
