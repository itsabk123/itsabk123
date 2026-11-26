import Link from "next/link";
import type { CrmStage } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { addContact, updateContact } from "./actions";

const STAGES: [CrmStage, string][] = [["NEW_LEAD", "New lead"], ["CONTACTED", "Contacted"], ["INTERESTED", "Interested"], ["NEGOTIATING", "Negotiating"], ["BOOKED", "Booked"], ["COMPLETED", "Completed"], ["REPEAT_CLIENT", "Repeat client"], ["NOT_INTERESTED", "Not interested"]];

export default async function Crm({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { acting } = await requireActing();
  const stage = STAGES.find(([s]) => s === sp.stage)?.[0];
  const contacts = await db.crmContact.findMany({ where: { ownerProfileId: acting.id, ...(stage ? { stage } : {}) }, include: { contact: true }, orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }] });
  const counts = await db.crmContact.groupBy({ by: ["stage"], where: { ownerProfileId: acting.id }, _count: true });
  const due = contacts.filter((c) => c.nextFollowUpAt && c.nextFollowUpAt <= new Date());
  return (
    <div>
      <PageHeader title="Contacts" sub="A lightweight CRM. Contacts are added automatically when you exchange proposals; stages update as deals progress." />
      <Flash sp={sp} />
      <div className="mb-4 flex flex-wrap gap-1">
        <Link href="/app/crm" className={`btn-sm ${!stage ? "btn-primary" : "btn-ghost"}`}>All</Link>
        {STAGES.map(([s, l]) => <Link key={s} href={`/app/crm?stage=${s}`} className={`btn-sm ${stage === s ? "btn-primary" : "btn-ghost"}`}>{l} <span className="text-xs opacity-60">{counts.find((c) => c.stage === s)?._count ?? 0}</span></Link>)}
      </div>
      {due.length > 0 && <div className="mb-4 rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm">{due.length} follow-up(s) due today or overdue.</div>}
      {contacts.length ? (
        <div className="space-y-2">
          {contacts.map((c) => (
            <form key={c.id} action={updateContact} className="card grid items-center gap-3 p-4 sm:grid-cols-[1fr_160px_150px_1.5fr_auto]">
              <input type="hidden" name="id" value={c.id} />
              <div><Link href={`/p/${c.contact.slug}`} className="link font-medium">{c.contact.displayName}</Link><div className="text-xs text-muted">{c.contact.type.toLowerCase()} · updated {formatDate(c.updatedAt)}</div></div>
              <select name="stage" defaultValue={c.stage} className="input !min-h-[36px] !py-1 text-sm">{STAGES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</select>
              <input name="nextFollowUpAt" type="date" defaultValue={c.nextFollowUpAt?.toISOString().slice(0, 10)} className={`input !min-h-[36px] !py-1 text-sm ${c.nextFollowUpAt && c.nextFollowUpAt <= new Date() ? "border-gold" : ""}`} aria-label="Next follow-up" />
              <input name="notes" defaultValue={c.notes ?? ""} className="input !min-h-[36px] !py-1 text-sm" placeholder="Notes" />
              <button className="btn-secondary btn-sm">Save</button>
            </form>
          ))}
        </div>
      ) : <Empty title="No contacts in this stage" />}
      <form action={addContact} className="card-pad mt-6 flex flex-wrap gap-2">
        <input name="slug" className="input flex-1" placeholder="Add a contact by profile URL or slug" required />
        <button className="btn-secondary">Add</button>
      </form>
    </div>
  );
}
