import { db } from "@/lib/db";
export const metadata = { title: "FAQ", description: "Answers about fees, payments, metrics, compliance and accounts." };
export const dynamic = "force-dynamic";

const DEFAULT_FAQ: [string, string][] = [
  ["Is it free to join?", "Yes. Profiles, discovery, messaging and proposals are free. A platform fee applies only to successful paid collaborations, deducted from the payee's payout. Optional plans add advanced tools."],
  ["Can I have more than one role?", "Yes. One account can hold a brand, podcast, guest and creator profile. Switch between them from your dashboard."],
  ["Do guests get paid?", "Only if they choose to. Guests pick what they're open to: free expert appearances, paid appearances, sponsored or promotional interviews, or panels."],
  ["How do payments work?", "The payer pays through our payment provider before work starts. A payment only shows as received when the provider confirms it. Funds are released to the creator after the deliverables are approved. This is a collection-and-release arrangement, not a regulated escrow account."],
  ["What happens if something goes wrong?", "Either party can open a dispute from the deal page. That pauses any payout while our team reviews. See the Disputes & Refunds policy."],
  ["Are audience numbers verified?", "Each figure shows its source: verified via a platform API, self-reported by the creator, reported by an advertiser, or a platform estimate. Self-reported numbers are clearly labelled."],
  ["Do I need a UAE Media Council advertiser permit?", "That depends on your situation and current rules. Joining the platform is not a permit. Creators can store permit details here, and regulated campaigns get human review. Check current requirements with the UAE Media Council or a legal adviser."],
  ["How are match scores calculated?", "A weighted score across audience, industry, geography, quality, budget, content and availability. We show the reasons, concerns and missing information. Scores never use gender, nationality or other sensitive attributes."],
  ["Can I delete my account?", "Yes, from Settings. We delete or anonymise your personal data except where we must keep records (e.g. invoices) by law."],
];

export default async function Faq() {
  const posts = await db.post.findMany({ where: { kind: "FAQ", status: "PUBLISHED" }, orderBy: { createdAt: "asc" } });
  const items: [string, string][] = [...DEFAULT_FAQ, ...posts.map((p) => [p.title, p.body] as [string, string])];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return (
    <div className="page max-w-3xl py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="h1 !text-4xl">Frequently asked questions</h1>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {items.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="flex cursor-pointer list-none justify-between gap-4 font-medium text-ink">{q}<span className="text-muted group-open:rotate-45">+</span></summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
