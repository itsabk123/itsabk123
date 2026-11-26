import { ChoiceButton } from "@/components/choice-button";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor, getActingContext } from "@/lib/access";
import { Avatar, Flash, SourceTag } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/deal-machine";
import { formatAed, formatNumber } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { approverProfileId, payeeProfileId } from "@/lib/deal-roles";
import { getConfig } from "@/lib/config";
import { calculateFees } from "@/lib/fees";
import { sendMessage } from "../../messages/actions";
import {
  acceptProposal, addTrackingLink, cancelDeal, counterProposal, declineDeal, leaveReview, openDispute,
  recordMetric, reviewDeliverable, signContract, startPayment, startWork, submitDeliverable,
} from "../actions";

type Deliv = { title: string; dueDate?: string | null };
const STEPS = ["PROPOSED", "NEGOTIATING", "AGREED", "CONTRACTED", "FUNDED", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

export default async function DealRoom({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      initiator: true, recipient: true, campaign: true, offering: true, contract: true,
      proposals: { orderBy: { createdAt: "desc" } },
      deliverables: { orderBy: { dueDate: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, include: { invoice: true } },
      payouts: true, reviews: true, disputes: { orderBy: { createdAt: "desc" } }, bookings: true,
      conversation: { include: { messages: { orderBy: { createdAt: "asc" }, take: 200 }, participants: true } },
      trackingLinks: true, metrics: { orderBy: { recordedAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!deal) notFound();
  const ctx = await getActingContext();
  let me: string | null = null;
  if (ctx?.acting && [deal.initiatorProfileId, deal.recipientProfileId].includes(ctx.acting.id)) me = ctx.acting.id;
  else if (await canActFor(user.id, deal.initiatorProfileId, false)) me = deal.initiatorProfileId;
  else if (await canActFor(user.id, deal.recipientProfileId, false)) me = deal.recipientProfileId;
  if (!me) redirect("/app/deals?err=Not+authorised");

  if (deal.conversation) {
    await db.conversationParticipant.updateMany({ where: { conversationId: deal.conversation.id, profileId: me }, data: { lastReadAt: new Date() } });
  }
  const meP = me === deal.initiatorProfileId ? deal.initiator : deal.recipient;
  const other = me === deal.initiatorProfileId ? deal.recipient : deal.initiator;
  const active = deal.proposals.find((p) => p.status === "ACTIVE");
  const agreed = deal.agreedProposalId ? deal.proposals.find((p) => p.id === deal.agreedProposalId) ?? null : null;
  const current = agreed ?? active ?? deal.proposals[0];
  const approver = approverProfileId(deal, agreed);
  const payee = payeeProfileId(deal, agreed);
  const iAmApprover = approver === me;
  const iAmPayer = agreed?.payerProfileId === me;
  const [commission, vat] = await Promise.all([getConfig("commission"), getConfig("vat")]);
  const fees = current && current.priceFils > 0 ? calculateFees(current.priceFils, deal.kind, { commission, vat }, { agencyManaged: !!(payee === deal.initiatorProfileId ? deal.initiator : deal.recipient).managedByOrgId }) : null;
  const myReview = deal.reviews.find((r) => r.authorProfileId === me);
  const signedByMe = deal.contract && (me === deal.initiatorProfileId ? deal.contract.initiatorAcceptedAt : deal.contract.recipientAcceptedAt);
  const signedByThem = deal.contract && (me === deal.initiatorProfileId ? deal.contract.recipientAcceptedAt : deal.contract.initiatorAcceptedAt);
  const pendingPayment = deal.payments.find((p) => p.status === "PENDING");
  const succeeded = deal.payments.find((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED");
  const stepIdx = STEPS.indexOf(deal.status as (typeof STEPS)[number]);
  const nameOf = (pid: string | null | undefined) => (pid === deal.initiatorProfileId ? deal.initiator.displayName : pid === deal.recipientProfileId ? deal.recipient.displayName : "—");
  const clicks = deal.trackingLinks.reduce((s, l) => s + l.clicks, 0);
  const proposalForm = (label: string) => (
    <form action={counterProposal} className="space-y-3">
      <input type="hidden" name="dealId" value={deal.id} />
      <div><label className="label text-xs" htmlFor="deliverables">Deliverables (one per line, optional "— YYYY-MM-DD")</label>
        <textarea id="deliverables" name="deliverables" className="input font-mono text-sm" rows={3} defaultValue={(current?.deliverables as Deliv[] | undefined)?.map((d) => `${d.title}${d.dueDate ? ` — ${d.dueDate}` : ""}`).join("\n")} required /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label text-xs" htmlFor="price">Price (AED)</label><input id="price" name="price" inputMode="decimal" className="input" defaultValue={current ? current.priceFils / 100 : ""} /></div>
        <div><label className="label text-xs" htmlFor="payer">Payer</label><select id="payer" name="payer" className="input" defaultValue={current?.payerProfileId === me ? "me" : "them"}><option value="me">{meP.displayName}</option><option value="them">{other.displayName}</option></select></div>
        <div><label className="label text-xs" htmlFor="publishDate">Publish date</label><input id="publishDate" name="publishDate" type="date" className="input" defaultValue={current?.publishDate?.toISOString().slice(0, 10)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label text-xs" htmlFor="revisions">Revisions</label><input id="revisions" name="revisions" type="number" min={0} max={5} className="input" defaultValue={current?.revisions ?? 1} /></div>
        <div className="sm:col-span-2"><label className="label text-xs" htmlFor="exclusivity">Exclusivity</label><input id="exclusivity" name="exclusivity" className="input" defaultValue={current?.exclusivity ?? ""} /></div>
      </div>
      <div><label className="label text-xs" htmlFor="usageRights">Usage rights</label><input id="usageRights" name="usageRights" className="input" defaultValue={current?.usageRights ?? ""} /></div>
      <div><label className="label text-xs" htmlFor="pmessage">Note</label><input id="pmessage" name="message" className="input" placeholder="What changed and why" /></div>
      <button className="btn-secondary">{label}</button>
    </form>
  );

  return (
    <div>
      <nav className="mb-4 text-xs text-muted"><Link href="/app/deals" className="no-underline">Deals</Link> / {deal.title}</nav>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow">{deal.kind.replaceAll("_", " ").toLowerCase()} · {deal.origin.replace("_", " ").toLowerCase()}</div>
          <h1 className="h2 mt-1">{deal.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Avatar src={other.avatarUrl} name={other.displayName} size={24} /> with <Link href={`/p/${other.slug}`} className="link">{other.displayName}</Link>
            {deal.campaign && <> · campaign <Link href={`/campaigns/${deal.campaign.slug}`} className="link">{deal.campaign.name}</Link></>}
          </div>
        </div>
        <span className={`self-start ${deal.status === "COMPLETED" ? "badge-ok" : deal.status === "DISPUTED" ? "badge-bad" : ["DECLINED", "CANCELLED"].includes(deal.status) ? "badge" : "badge-gold"} !text-sm`}>{STATUS_LABEL[deal.status]}</span>
      </div>
      <Flash sp={sp} />

      {stepIdx >= 0 && (
        <ol className="mb-8 flex gap-1 overflow-x-auto">
          {STEPS.filter((s) => s !== "FUNDED" || (current?.priceFils ?? 0) > 0).map((s) => {
            const i = STEPS.indexOf(s);
            return <li key={s} className={`min-w-[88px] flex-1 border-t-2 pt-2 text-xs ${i <= stepIdx ? "border-ink text-ink" : "border-line text-muted"}`}>{STATUS_LABEL[s].split(" —")[0]}</li>;
          })}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* Next action */}
          <section className="card-pad space-y-4">
            <h2 className="h3">Next step</h2>
            {["PROPOSED", "NEGOTIATING"].includes(deal.status) && active && (
              active.authorProfileId === me ? (
                <p className="text-sm text-muted">Waiting for {other.displayName} to accept, counter or decline your latest proposal.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <form action={acceptProposal}><input type="hidden" name="dealId" value={deal.id} /><button className="btn-primary">Accept these terms</button></form>
                  <form action={declineDeal}><input type="hidden" name="dealId" value={deal.id} /><button className="btn-ghost">Decline</button></form>
                </div>
              )
            )}
            {["PROPOSED", "NEGOTIATING"].includes(deal.status) && <details><summary className="cursor-pointer text-sm text-ink underline">Propose different terms</summary><div className="mt-3">{proposalForm("Send counter-offer")}</div></details>}
            {deal.status === "AGREED" && deal.contract && (
              signedByMe ? <p className="text-sm text-muted">You signed on {formatDate(signedByMe)}. Waiting for {other.displayName}.</p> : (
                <form action={signContract} className="space-y-3">
                  <input type="hidden" name="dealId" value={deal.id} /><input type="hidden" name="hash" value={deal.contract.bodyHash} />
                  <p className="text-sm">Review the agreement below. {signedByThem ? `${other.displayName} has already signed.` : ""}</p>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1" required /> I accept this agreement on behalf of {meP.displayName} and understand it is a template, not legal advice.</label>
                  <button className="btn-primary">Sign agreement</button>
                </form>
              )
            )}
            {deal.status === "CONTRACTED" && agreed && agreed.priceFils > 0 && (
              iAmPayer ? (
                <form action={startPayment} className="space-y-2">
                  <input type="hidden" name="dealId" value={deal.id} />
                  <p className="text-sm">Pay <span className="text-ink">{formatAed(agreed.priceFils)}</span> to start the collaboration. Funds are held by the platform and released to {other.displayName} once you approve the deliverables.</p>
                  {pendingPayment && <p className="text-xs text-muted">A checkout was started {formatDateTime(pendingPayment.createdAt)} and hasn't been confirmed by the provider yet.</p>}
                  {deal.payments.some((p) => p.status === "FAILED") && <p className="text-xs text-bad">A previous attempt failed. You can try again.</p>}
                  <button className="btn-primary">{pendingPayment ? "Continue to payment" : "Pay securely"}</button>
                </form>
              ) : <p className="text-sm text-muted">Waiting for {nameOf(agreed.payerProfileId)} to pay. You'll be notified when the payment provider confirms it.</p>
            )}
            {deal.status === "FUNDED" && (payee === me
              ? <form action={startWork}><input type="hidden" name="dealId" value={deal.id} /><p className="mb-2 text-sm">Payment confirmed. Start when you're ready.</p><button className="btn-primary">Start work</button></form>
              : <p className="text-sm text-muted">Payment confirmed. Waiting for {other.displayName} to start.</p>)}
            {["IN_PROGRESS", "DELIVERED"].includes(deal.status) && <p className="text-sm text-muted">{iAmApprover ? "Review submissions below as they arrive." : "Submit each deliverable below for approval."}</p>}
            {deal.status === "DISPUTED" && <p className="text-sm text-bad">This deal is in dispute. Payout is paused while our team reviews. We'll contact both parties.</p>}
            {deal.status === "COMPLETED" && (myReview ? <p className="text-sm text-muted">Thanks for reviewing. {deal.reviews.length < 2 ? "Reviews are revealed when both are in, or after 14 days." : "Both reviews are published."}</p> : (
              <form action={leaveReview} className="space-y-3">
                <input type="hidden" name="dealId" value={deal.id} />
                <div className="label">Review {other.displayName}</div>
                <div className="flex gap-3">{[1, 2, 3, 4, 5].map((r) => <label key={r} className="check"><input type="radio" name="rating" value={r} required />{r}★</label>)}</div>
                <textarea name="body" className="input" placeholder="What was it like working together? (visible publicly)" />
                <button className="btn-primary">Submit review</button>
              </form>
            ))}
            {deal.status === "COMPLETED" && <Link href={`/app/deals/new?to=${other.id}`} className="btn-secondary btn-sm">Rebook {other.displayName}</Link>}
            {["DECLINED", "CANCELLED"].includes(deal.status) && <p className="text-sm text-muted">{deal.cancelledReason ?? "This deal is closed."}</p>}
          </section>

          {deal.deliverables.length > 0 && (
            <section className="card-pad">
              <h2 className="h3 mb-3">Deliverables</h2>
              <div className="space-y-3">
                {deal.deliverables.map((d) => (
                  <div key={d.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><div className="font-medium text-ink">{d.title}</div><div className="text-xs text-muted">Due {formatDate(d.dueDate)}</div></div>
                      <span className={d.status === "APPROVED" ? "badge-ok" : d.status === "SUBMITTED" ? "badge-accent" : d.status === "REVISION_REQUESTED" ? "badge-warn" : "badge"}>{d.status.replace("_", " ").toLowerCase()}</span>
                    </div>
                    {d.submissionUrl && <a href={d.submissionUrl} target="_blank" rel="noopener nofollow" className="link mt-2 block text-sm">{d.submissionUrl}</a>}
                    {d.notes && <p className="mt-1 text-sm">{d.notes}</p>}
                    {d.feedback && <p className="mt-1 text-sm text-warn">Feedback: {d.feedback}</p>}
                    {!iAmApprover && ["IN_PROGRESS", "DELIVERED"].includes(deal.status) && ["PENDING", "REVISION_REQUESTED"].includes(d.status) && (
                      <form action={submitDeliverable} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input type="hidden" name="dealId" value={deal.id} /><input type="hidden" name="deliverableId" value={d.id} />
                        <input name="submissionUrl" className="input" placeholder="Link to draft or published post" required />
                        <input name="notes" className="input" placeholder="Notes" />
                        <button className="btn-secondary">Submit</button>
                      </form>
                    )}
                    {iAmApprover && d.status === "SUBMITTED" && deal.status !== "DISPUTED" && (
                      <form action={reviewDeliverable} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="dealId" value={deal.id} /><input type="hidden" name="deliverableId" value={d.id} />
                        <input name="feedback" className="input flex-1" placeholder="Feedback (required for revisions)" />
                        <ChoiceButton name="decision" value="approve" className="btn-primary">Approve</ChoiceButton>
                        <ChoiceButton name="decision" value="revise" className="btn-secondary">Request revision</ChoiceButton>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {deal.contract && (
            <section className="card-pad">
              <div className="flex items-center justify-between"><h2 className="h3">Agreement</h2><span className="text-xs text-muted">{deal.contract.templateVersion} · #{deal.contract.bodyHash.slice(0, 10)}</span></div>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 font-sans text-sm leading-6">{deal.contract.body}</pre>
              <div className="mt-2 text-xs text-muted">{deal.initiator.displayName}: {deal.contract.initiatorAcceptedAt ? `signed ${formatDateTime(deal.contract.initiatorAcceptedAt)}` : "not signed"} · {deal.recipient.displayName}: {deal.contract.recipientAcceptedAt ? `signed ${formatDateTime(deal.contract.recipientAcceptedAt)}` : "not signed"}</div>
              <p className="mt-2 text-xs text-muted">Template agreement for convenience — not legal advice. Have it reviewed if the engagement is significant.</p>
            </section>
          )}

          <section className="card-pad">
            <h2 className="h3 mb-3">Conversation</h2>
            {deal.conversation ? (
              <>
                <div className="max-h-[28rem] space-y-3 overflow-y-auto">
                  {deal.conversation.messages.map((m) => (
                    <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.senderProfileId === me ? "ms-auto bg-ink text-paper" : "bg-paper"}`}>
                      <div className="whitespace-pre-line">{m.flaggedSpam && m.senderProfileId !== me ? <span className="italic text-muted">Message held for review</span> : m.body}</div>
                      <div className={`mt-1 text-[11px] ${m.senderProfileId === me ? "text-paper/60" : "text-muted"}`}>{formatDateTime(m.createdAt, user.timezone)}</div>
                    </div>
                  ))}
                  {!deal.conversation.messages.length && <p className="text-sm text-muted">No messages yet.</p>}
                </div>
                <form action={sendMessage} className="mt-4 flex gap-2">
                  <input type="hidden" name="conversationId" value={deal.conversation.id} /><input type="hidden" name="back" value={`/app/deals/${deal.id}`} />
                  <textarea name="body" className="input !min-h-[44px] flex-1" rows={2} placeholder="Write a message…" required />
                  <button className="btn-primary self-end">Send</button>
                </form>
              </>
            ) : <p className="text-sm text-muted">No conversation.</p>}
          </section>

          {["IN_PROGRESS", "DELIVERED", "COMPLETED", "DISPUTED"].includes(deal.status) && (
            <section className="card-pad space-y-4">
              <h2 className="h3">Measurement</h2>
              <p className="text-xs text-muted">Clicks on tracked links are counted by the platform (bots and repeat clicks may be included; attribution window: any click while the link is live). All other results are logged with their source and are not independently verified.</p>
              {deal.trackingLinks.length > 0 && (
                <div className="space-y-2">
                  {deal.trackingLinks.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                      <div className="min-w-0"><div className="font-medium text-ink">{l.label ?? "Tracked link"}{l.couponCode ? ` · code ${l.couponCode}` : ""}</div><div className="truncate text-xs text-muted">{(process.env.APP_URL ?? "") + `/r/${l.slug}`} → {l.destinationUrl}</div></div>
                      <span className="badge-ok">{formatNumber(l.clicks)} clicks</span>
                    </div>
                  ))}
                </div>
              )}
              <form action={addTrackingLink} className="grid gap-2 sm:grid-cols-4">
                <input type="hidden" name="dealId" value={deal.id} />
                <input name="destination" className="input sm:col-span-2" placeholder="Landing page URL" defaultValue={deal.campaign?.landingUrl ?? ""} required />
                <input name="label" className="input" placeholder="Label" />
                <input name="couponCode" className="input" placeholder="Coupon code (optional)" />
                <button className="btn-secondary sm:col-span-4 sm:justify-self-start">Create tracked link</button>
              </form>
              <div className="card overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Metric</th><th>Value</th><th>Source</th><th>Logged</th></tr></thead>
                  <tbody>
                    <tr><td>Tracked link clicks</td><td>{formatNumber(clicks)}</td><td><SourceTag source="API_VERIFIED" /></td><td className="text-muted">live</td></tr>
                    {deal.metrics.map((m) => <tr key={m.id}><td>{m.key.replaceAll("_", " ")}{m.note ? <div className="text-xs text-muted">{m.note}</div> : null}</td><td>{m.key === "revenue_aed" ? formatAed(m.value * 100) : formatNumber(m.value)}</td><td><SourceTag source={m.source} /></td><td className="text-muted">{formatDate(m.recordedAt)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              {(() => {
                const leads = deal.metrics.filter((m) => m.key === "leads").reduce((s, m) => s + m.value, 0);
                const conv = deal.metrics.filter((m) => m.key === "conversions").reduce((s, m) => s + m.value, 0);
                const price = agreed?.priceFils ?? 0;
                return price > 0 && (leads > 0 || conv > 0) ? (
                  <p className="text-sm">{leads > 0 && <>Cost per lead: <span className="text-ink">{formatAed(Math.round(price / leads))}</span>. </>}{conv > 0 && <>Cost per acquisition: <span className="text-ink">{formatAed(Math.round(price / conv))}</span>. </>}<span className="text-xs text-muted">Based on reported figures above.</span></p>
                ) : null;
              })()}
              <form action={recordMetric} className="grid gap-2 sm:grid-cols-4">
                <input type="hidden" name="dealId" value={deal.id} />
                <select name="key" className="input"><option value="impressions">Impressions</option><option value="reach">Reach</option><option value="views">Views</option><option value="downloads">Downloads</option><option value="engagements">Engagements</option><option value="link_clicks">Link clicks (platform analytics)</option><option value="coupon_redemptions">Coupon redemptions</option><option value="leads">Leads</option><option value="conversions">Conversions</option><option value="revenue_aed">Revenue (AED)</option></select>
                <input name="value" className="input" placeholder="Value" inputMode="decimal" required />
                <input name="note" className="input" placeholder="Where this came from" />
                <button className="btn-secondary">Log result</button>
              </form>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {current && (
            <section className="card-pad space-y-2 text-sm">
              <div className="flex items-center justify-between"><h2 className="h3">{agreed ? "Agreed terms" : "Latest proposal"}</h2>{!agreed && <span className="text-xs text-muted">by {nameOf(current.authorProfileId)}</span>}</div>
              <div className="font-serif text-2xl text-ink">{current.priceFils ? formatAed(current.priceFils) : "No fee"}</div>
              {current.priceFils > 0 && <div className="text-xs text-muted">Paid by {nameOf(current.payerProfileId)}</div>}
              {fees && payee === me && <div className="rounded-lg bg-paper p-2 text-xs">You receive {formatAed(fees.payeeNetFils)} after the {fees.commissionPct}% platform fee{fees.vatOnFeeFils ? ` and ${vat.ratePct}% VAT on the fee` : ""}.</div>}
              <ul className="space-y-1">{(current.deliverables as Deliv[]).map((d, i) => <li key={i}>— {d.title}{d.dueDate ? <span className="text-muted"> · {formatDate(new Date(d.dueDate))}</span> : null}</li>)}</ul>
              {current.publishDate && <div className="text-muted">Publish: {formatDate(current.publishDate)}</div>}
              {current.usageRights && <div className="text-muted">Usage: {current.usageRights}</div>}
              {current.exclusivity && <div className="text-muted">Exclusivity: {current.exclusivity}</div>}
              <div className="text-muted">{current.revisions} revision round(s)</div>
            </section>
          )}
          {deal.bookings.length > 0 && (
            <section className="card-pad text-sm">
              <h2 className="h3 mb-2">Booking</h2>
              {deal.bookings.map((b) => <div key={b.id}>{formatDateTime(b.startsAt, user.timezone)} · {b.mode === "VIRTUAL" ? "Virtual" : "In person"} · <span className="badge">{b.status.toLowerCase()}</span> <Link href="/app/bookings" className="link">Manage</Link></div>)}
            </section>
          )}
          {(succeeded || deal.payouts.length > 0) && (
            <section className="card-pad space-y-2 text-sm">
              <h2 className="h3">Money</h2>
              {deal.payments.map((p) => (
                <div key={p.id} className="flex justify-between"><span>Payment {formatAed(p.amountFils)}</span><span className={p.status === "SUCCEEDED" ? "badge-ok" : p.status === "FAILED" ? "badge-bad" : "badge"}>{p.status.toLowerCase()}</span></div>
              ))}
              {deal.payouts.filter(() => payee === me || iAmPayer).map((po) => (
                <div key={po.id} className="flex justify-between"><span>Payout {formatAed(po.amountFils)}</span><span className={po.status === "PAID" ? "badge-ok" : po.status === "ON_HOLD" ? "badge-bad" : "badge-warn"}>{po.status.toLowerCase()}</span></div>
              ))}
              {succeeded?.invoice && <Link href={`/app/finance/invoices/${succeeded.invoice.id}`} className="link">Invoice {succeeded.invoice.number}</Link>}
            </section>
          )}
          <section className="card-pad space-y-3 text-sm">
            <h2 className="h3">Proposal history</h2>
            <ul className="space-y-2">
              {deal.proposals.map((p) => <li key={p.id} className={p.status === "SUPERSEDED" ? "text-muted" : ""}>{formatDate(p.createdAt)} · {nameOf(p.authorProfileId)} · {p.priceFils ? formatAed(p.priceFils) : "no fee"} <span className="badge">{p.status.toLowerCase()}</span>{p.message && <div className="text-xs text-muted">“{p.message}”</div>}</li>)}
            </ul>
          </section>
          <section className="card-pad space-y-2 text-xs text-muted">
            <h2 className="h3 text-sm">Activity</h2>
            {deal.events.map((e) => <div key={e.id}>{formatDateTime(e.createdAt, user.timezone)} — {e.type.replace("status:", "→ ").toLowerCase()}{e.detail ? ` (${e.detail})` : ""}</div>)}
          </section>
          {["PROPOSED", "NEGOTIATING", "AGREED", "CONTRACTED", "FUNDED"].includes(deal.status) && (
            <details className="card-pad text-sm"><summary className="cursor-pointer">Cancel this deal</summary>
              <form action={cancelDeal} className="mt-3 space-y-2"><input type="hidden" name="dealId" value={deal.id} /><input name="reason" className="input" placeholder="Reason" /><p className="text-xs text-muted">{deal.status === "FUNDED" ? "Work hasn't started, so the payer is refunded in full." : "No money has moved."}</p><button className="btn-danger btn-sm">Cancel deal</button></form>
            </details>
          )}
          {["FUNDED", "IN_PROGRESS", "DELIVERED"].includes(deal.status) && (
            <details className="card-pad text-sm"><summary className="cursor-pointer">Open a dispute</summary>
              <form action={openDispute} className="mt-3 space-y-2"><input type="hidden" name="dealId" value={deal.id} />
                <select name="reason" className="input" required><option value="">Reason…</option><option>Deliverables not provided</option><option>Deliverables don't match the agreement</option><option>Unreasonable approval delay</option><option>Disclosure or compliance problem</option><option>Other</option></select>
                <textarea name="details" className="input" placeholder="What happened? Include dates and links." required minLength={20} /><p className="text-xs text-muted">Opening a dispute pauses any payout. See the <Link href="/legal/disputes" className="link">policy</Link>.</p><button className="btn-danger btn-sm">Open dispute</button></form>
            </details>
          )}
          {deal.disputes.map((d) => <div key={d.id} className="card-pad text-sm"><div className="h3">Dispute · {d.status.replaceAll("_", " ").toLowerCase()}</div><p className="mt-1">{d.reason}</p>{d.resolution && <p className="mt-1 text-muted">Resolution: {d.resolution}</p>}</div>)}
        </aside>
      </div>
    </div>
  );
}
