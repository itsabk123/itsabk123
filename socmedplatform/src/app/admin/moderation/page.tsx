import Link from "next/link";
import { db } from "@/lib/db";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { REGULATED_CATEGORIES } from "@/lib/taxonomy";
import { releaseMessage, resolveDispute, resolveFlag, resolveReport, reviewCampaign } from "../actions";
import { ChoiceButton } from "@/components/choice-button";

export default async function Moderation({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [disputes, campaigns, reports, flags, messages] = await Promise.all([
    db.dispute.findMany({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } }, include: { deal: { include: { initiator: true, recipient: true } } }, orderBy: { createdAt: "asc" } }),
    db.campaign.findMany({ where: { complianceStatus: "PENDING" }, include: { brand: true } }),
    db.report.findMany({ where: { status: "OPEN" }, include: { reporter: { select: { email: true } } }, orderBy: { createdAt: "asc" } }),
    db.fraudFlag.findMany({ where: { status: "OPEN" }, include: { profile: true }, orderBy: { score: "desc" } }),
    db.message.findMany({ where: { flaggedSpam: true }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const Section = ({ title, n, children }: { title: string; n: number; children: React.ReactNode }) => <section className="space-y-3"><h2 className="h3">{title} <span className="text-muted">({n})</span></h2>{n ? children : <Empty title="Nothing waiting" />}</section>;
  return (
    <div className="space-y-10">
      <PageHeader title="Trust & safety" sub="Automated signals only create flags for review. Never suspend on a flag alone — look at evidence, contact the user, and record a reason." />
      <Flash sp={sp} />
      <Section title="Disputes" n={disputes.length}>
        {disputes.map((d) => (
          <div key={d.id} className="card-pad space-y-2 text-sm">
            <div className="flex justify-between"><Link href={`/app/deals/${d.dealId}`} className="link font-medium">{d.deal.title}</Link><span className="text-xs text-muted">opened {formatDate(d.createdAt)} · {d.status.toLowerCase()}</span></div>
            <div className="text-muted">{d.deal.initiator.displayName} × {d.deal.recipient.displayName} · was {d.previousDealStatus.toLowerCase()}</div>
            <p><span className="text-ink">{d.reason}:</span> {d.details}</p>
            <form action={resolveDispute} className="flex flex-wrap gap-2">
              <input type="hidden" name="disputeId" value={d.id} />
              <input name="resolution" className="input flex-1" placeholder="Resolution note (shared with both parties)" />
              <input name="refundPct" className="input !w-28" placeholder="Split refund %" inputMode="numeric" />
              <ChoiceButton name="outcome" value="UNDER_REVIEW" className="btn-ghost btn-sm">Mark reviewing</ChoiceButton>
              <ChoiceButton name="outcome" value="RESOLVED_RELEASE" className="btn-secondary btn-sm">Release to creator</ChoiceButton>
              <ChoiceButton name="outcome" value="RESOLVED_SPLIT" className="btn-secondary btn-sm">Split</ChoiceButton>
              <ChoiceButton name="outcome" value="RESOLVED_REFUND" className="btn-danger btn-sm">Full refund</ChoiceButton>
            </form>
          </div>
        ))}
      </Section>
      <Section title="Campaign compliance review" n={campaigns.length}>
        {campaigns.map((c) => (
          <form key={c.id} action={reviewCampaign} className="card-pad flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="campaignId" value={c.id} />
            <div className="min-w-0 flex-1"><Link href={`/campaigns/${c.slug}`} className="link font-medium">{c.name}</Link><div className="text-xs text-muted">{c.brand.displayName}{c.brand.verifiedAt ? " (verified)" : " (unverified)"} · {REGULATED_CATEGORIES[c.regulatedCategory ?? ""] ?? c.regulatedCategory}</div></div>
            <input name="notes" className="input !w-64" placeholder="Notes to brand" />
            <ChoiceButton name="decision" value="approve" className="btn-primary btn-sm">Approve</ChoiceButton><ChoiceButton name="decision" value="reject" className="btn-danger btn-sm">Reject</ChoiceButton>
          </form>
        ))}
      </Section>
      <Section title="Reports" n={reports.length}>
        {reports.map((r) => (
          <form key={r.id} action={resolveReport} className="card-pad flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="reportId" value={r.id} />
            <div className="min-w-0 flex-1"><div className="font-medium text-ink">{r.reason} · {r.targetType.toLowerCase()} {r.targetType === "PROFILE" && <Link href={`/admin/users?q=${r.targetId}`} className="link text-xs">find</Link>}</div><div className="text-xs text-muted">{r.details} · by {r.reporter.email} · {formatDate(r.createdAt)} · target {r.targetId}</div></div>
            <input name="resolution" className="input !w-56" placeholder="Resolution" />
            <ChoiceButton name="status" value="ACTIONED" className="btn-secondary btn-sm">Actioned</ChoiceButton><ChoiceButton name="status" value="DISMISSED" className="btn-ghost btn-sm">Dismiss</ChoiceButton>
          </form>
        ))}
      </Section>
      <Section title="Quality & fraud flags" n={flags.length}>
        {flags.map((f) => (
          <form key={f.id} action={resolveFlag} className="card-pad flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="flagId" value={f.id} />
            <div className="min-w-0 flex-1"><div className="font-medium text-ink">{f.kind.replaceAll("_", " ").toLowerCase()} · {f.profile ? <Link href={`/p/${f.profile.slug}`} className="link">{f.profile.displayName}</Link> : "—"}</div><div className="text-xs text-muted">{f.details} · score {f.score.toFixed(2)}</div></div>
            <ChoiceButton name="status" value="CLEARED" className="btn-ghost btn-sm">Clear</ChoiceButton><ChoiceButton name="status" value="CONFIRMED" className="btn-danger btn-sm">Confirm</ChoiceButton>
          </form>
        ))}
      </Section>
      <Section title="Messages held as possible spam" n={messages.length}>
        {messages.map((m) => (
          <form key={m.id} action={releaseMessage} className="card-pad flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="messageId" value={m.id} />
            <p className="min-w-0 flex-1 whitespace-pre-line">{m.body.slice(0, 400)}</p>
            <ChoiceButton name="decision" value="release" className="btn-secondary btn-sm">Release</ChoiceButton><ChoiceButton name="decision" value="delete" className="btn-danger btn-sm">Delete</ChoiceButton>
          </form>
        ))}
      </Section>
    </div>
  );
}
