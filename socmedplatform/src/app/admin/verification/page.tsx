import Link from "next/link";
import { db } from "@/lib/db";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { signedUrl } from "@/lib/storage";
import { formatDate } from "@/lib/time";
import { reviewDocument, verifyProfile } from "../actions";
import { ChoiceButton } from "@/components/choice-button";

export default async function Verification({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [docs, candidates] = await Promise.all([
    db.verificationDocument.findMany({ where: { status: "PENDING" }, include: { profile: true }, orderBy: { createdAt: "asc" } }),
    db.profile.findMany({ where: { verifiedAt: null, status: "PUBLISHED", documents: { some: { status: "APPROVED" } } }, take: 30 }),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title="Verification" sub="Review uploaded documents. Links expire after 5 minutes. Approving a permit copies its number and expiry to the creator profile." />
      <Flash sp={sp} />
      {docs.length ? docs.map((d) => (
        <div key={d.id} className="card-pad flex flex-wrap items-start justify-between gap-4 text-sm">
          <div><div className="font-medium text-ink">{d.kind.replaceAll("_", " ").toLowerCase()} — <Link href={`/p/${d.profile.slug}`} className="link">{d.profile.displayName}</Link></div>
            <div className="text-xs text-muted">Ref {d.reference ?? "—"} · expires {formatDate(d.expiresAt)} · uploaded {formatDate(d.createdAt)} · {Math.round(d.sizeBytes / 1024)} KB</div>
            <a href={signedUrl(d.storageKey)} target="_blank" rel="noopener" className="link mt-1 inline-block">Open document</a></div>
          <form action={reviewDocument} className="flex flex-wrap gap-2"><input type="hidden" name="docId" value={d.id} /><input name="notes" className="input !min-h-[32px] !w-56 !py-0 text-xs" placeholder="Notes to user" /><ChoiceButton name="decision" value="approve" className="btn-primary btn-sm">Approve</ChoiceButton><ChoiceButton name="decision" value="reject" className="btn-danger btn-sm">Reject</ChoiceButton></form>
        </div>
      )) : <Empty title="No documents waiting" />}
      {candidates.length > 0 && (
        <section>
          <h2 className="h3 mb-3">Ready to verify (approved documents on file)</h2>
          <div className="space-y-2">{candidates.map((p) => (
            <form key={p.id} action={verifyProfile} className="card flex items-center justify-between p-3 text-sm"><input type="hidden" name="profileId" value={p.id} /><input type="hidden" name="verified" value="1" /><Link href={`/p/${p.slug}`} className="link">{p.displayName}</Link><button className="btn-secondary btn-sm">Mark verified</button></form>
          ))}</div>
        </section>
      )}
    </div>
  );
}
