import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ProfileType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor } from "@/lib/access";
import { contextFromCampaign, findMatches } from "@/lib/match-data";
import { Avatar, Empty, Flash, PageHeader, ScoreRing, Stat } from "@/components/ui";
import { budgetLabel } from "@/components/campaign-card";
import { STATUS_LABEL } from "@/lib/deal-machine";
import { formatAed, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { OFFERING_KINDS } from "@/lib/taxonomy";
import { inviteToCampaign, setCampaignStatus } from "../actions";

export default async function ManageCampaign({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const c = await db.campaign.findUnique({
    where: { id },
    include: {
      brand: true, deliverables: true, compliance: true, trackingLinks: true,
      deals: { include: { initiator: true, recipient: true, proposals: { where: { status: { in: ["ACTIVE", "ACCEPTED"] } } }, metrics: true, payments: { where: { status: "SUCCEEDED" } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();
  if (!(await canActFor(user.id, c.brandProfileId, false))) redirect("/app/campaigns?err=Not+authorised");
  const already = c.deals.map((d) => (d.initiatorProfileId === c.brandProfileId ? d.recipientProfileId : d.initiatorProfileId));
  const matches = ["DRAFT", "OPEN", "IN_PROGRESS", "PENDING_REVIEW"].includes(c.status)
    ? await findMatches({ ctx: contextFromCampaign(c), types: c.creatorTypes as ProfileType[], excludeProfileIds: [c.brandProfileId, ...already], feedbackSourceId: c.brandProfileId, limit: 12 })
    : [];
  const spend = c.deals.flatMap((d) => d.payments).reduce((s, p) => s + p.amountFils, 0);
  const metric = (k: string) => c.deals.flatMap((d) => d.metrics).filter((m) => m.key === k).reduce((s, m) => s + m.value, 0);
  const clicks = c.trackingLinks.reduce((s, l) => s + l.clicks, 0);
  const leads = metric("leads");
  const applicants = c.deals.filter((d) => d.origin === "APPLICATION");
  const invited = c.deals.filter((d) => d.origin === "INVITATION");
  const actions: [string, string][] =
    c.status === "DRAFT" ? [["OPEN", "Publish"], ["CANCELLED", "Cancel"]] :
    c.status === "OPEN" ? [["IN_PROGRESS", "Close to new applicants"], ["DRAFT", "Unpublish"], ["CANCELLED", "Cancel"]] :
    c.status === "IN_PROGRESS" ? [["OPEN", "Reopen applications"], ["COMPLETED", "Mark complete"]] :
    c.status === "PENDING_REVIEW" ? [["DRAFT", "Withdraw to draft"]] : [];

  return (
    <div>
      <PageHeader
        eyebrow={`${c.brand.displayName} · ${c.status.replace("_", " ").toLowerCase()}`}
        title={c.name}
        sub={`${c.objective} · ${budgetLabel(c)} · ${c.targetEmirates.join(", ") || "All UAE"}`}
        actions={<>
          <Link href={`/campaigns/${c.slug}`} className="btn-secondary">View public page</Link>
          {actions.map(([s, l]) => <form key={s} action={setCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value={s} /><button className={s === "CANCELLED" ? "btn-ghost" : "btn-secondary"}>{l}</button></form>)}
        </>}
      />
      <Flash sp={sp} />
      {c.status === "PENDING_REVIEW" && <div className="mb-6 rounded-xl border border-warn/30 bg-[#FBF1E2] px-4 py-3 text-sm text-warn">Awaiting compliance review for a regulated category. You can still invite creators privately; the public page goes live after approval.</div>}
      {c.complianceStatus === "REJECTED" && <div className="mb-6 rounded-xl border border-bad/30 bg-[#FBEBEA] px-4 py-3 text-sm text-bad">Compliance review did not pass. {c.complianceNotes}</div>}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Proposals" value={c.deals.length} note={`${applicants.length} applied · ${invited.length} invited`} />
        <Stat label="Active / done" value={`${c.deals.filter((d) => ["CONTRACTED", "FUNDED", "IN_PROGRESS", "DELIVERED"].includes(d.status)).length} / ${c.deals.filter((d) => d.status === "COMPLETED").length}`} />
        <Stat label="Paid (confirmed)" value={formatAed(spend)} />
        <Stat label="Tracked clicks" value={formatNumber(clicks)} note="Counted by platform" />
        <Stat label="Leads (reported)" value={formatNumber(leads)} note={leads && spend ? `${formatAed(Math.round(spend / leads))} per lead` : "Logged per deal"} />
      </div>

      <section className="mb-10">
        <h2 className="h3 mb-3">Proposals</h2>
        {c.deals.length ? (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Creator</th><th>Route</th><th>Match</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>{c.deals.map((d) => {
                const other = d.initiatorProfileId === c.brandProfileId ? d.recipient : d.initiator;
                const p = d.proposals[0];
                return (
                  <tr key={d.id}>
                    <td><Link href={`/app/deals/${d.id}`} className="link">{other.displayName}</Link><div className="text-xs text-muted">{other.type.toLowerCase()}</div></td>
                    <td className="text-muted">{d.origin === "APPLICATION" ? "Applied" : "Invited"}</td>
                    <td>{d.matchScore ?? "—"}</td>
                    <td>{p ? (p.priceFils ? formatAed(p.priceFils) : "No fee") : "—"}</td>
                    <td><span className="badge">{STATUS_LABEL[d.status]}</span></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <Empty title="No proposals yet" body="Invite recommended creators below, or share the public campaign page." />}
      </section>

      {matches.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between"><h2 className="h3">Recommended for this brief</h2><span className="text-xs text-muted">Scores weigh audience, industry, geography, quality, budget, content and availability</span></div>
          <form action={inviteToCampaign} className="space-y-3">
            <input type="hidden" name="campaignId" value={c.id} />
            <div className="grid gap-3 md:grid-cols-2">
              {matches.map(({ result, profile }) => (
                <label key={profile.id} className="card flex cursor-pointer gap-3 p-4 has-[:checked]:border-ink">
                  <input type="checkbox" name="profileIds" value={profile.id} className="mt-1" />
                  <input type="hidden" name={`score_${profile.id}`} value={result.score} />
                  <Avatar src={profile.avatarUrl} name={profile.displayName} size={40} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex items-center gap-2"><Link href={`/p/${profile.slug}`} className="link font-medium">{profile.displayName}</Link>{profile.verifiedAt && <span className="text-accent">✓</span>}{profile.isDemo && <span className="badge-warn">Demo</span>}</div>
                    <div className="text-xs text-muted">{profile.type.toLowerCase()} · {profile.emirate ?? "UAE"}</div>
                    {result.reasons.length > 0 && <div className="mt-1 text-xs">+ {result.reasons.slice(0, 3).join(" · ")}</div>}
                    {result.concerns.length > 0 && <div className="text-xs text-warn">– {result.concerns.slice(0, 2).join(" · ")}</div>}
                    {result.missing.length > 0 && <div className="text-xs text-muted">Missing: {result.missing.slice(0, 3).join(", ")}</div>}
                    {result.suggestedFormat && <div className="text-xs text-muted">Suggested: {OFFERING_KINDS[result.suggestedFormat]?.label}</div>}
                  </div>
                  <ScoreRing score={result.score} />
                </label>
              ))}
            </div>
            <textarea name="message" className="input" rows={2} placeholder="Optional note to include with each invitation" />
            <button className="btn-primary">Invite selected</button>
          </form>
        </section>
      )}
      {matches.length === 0 && ["OPEN", "DRAFT", "IN_PROGRESS"].includes(c.status) && (
        <Empty title="No strong matches yet" body="Supply in this niche may be thin. Our team can source creators for you." action={<Link href="/contact?topic=matchmaking" className="btn-secondary">Request assisted matchmaking</Link>} />
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card-pad text-sm">
          <h2 className="h3 mb-2">Brief</h2>
          <dl className="space-y-1">
            <div><dt className="inline text-muted">Creators: </dt><dd className="inline">{c.creatorTypes.join(", ").toLowerCase()}</dd></div>
            <div><dt className="inline text-muted">Formats: </dt><dd className="inline">{c.contentFormats.join(", ") || "—"}</dd></div>
            <div><dt className="inline text-muted">Deliverables: </dt><dd className="inline">{c.deliverables.map((d) => `${d.quantity}× ${d.kind}`).join(", ") || "—"}</dd></div>
            <div><dt className="inline text-muted">Dates: </dt><dd className="inline">{formatDate(c.startDate)} – {formatDate(c.endDate)}</dd></div>
            <div><dt className="inline text-muted">Success metrics: </dt><dd className="inline">{c.successMetrics.join(", ") || "—"}</dd></div>
          </dl>
          {c.instructions && <p className="mt-3 whitespace-pre-line">{c.instructions}</p>}
        </div>
        <div className="card-pad text-sm">
          <h2 className="h3 mb-2">Compliance checklist</h2>
          <ul className="space-y-1">{c.compliance.map((r) => <li key={r.id}>{r.status === "APPROVED" ? "✓" : r.status === "PENDING" ? "○" : "–"} {r.check}</li>)}</ul>
          <p className="mt-3 text-xs text-muted">Checklist support only — not legal advice.</p>
        </div>
      </section>
    </div>
  );
}
