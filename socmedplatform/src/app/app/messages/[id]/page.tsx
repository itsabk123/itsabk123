import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor } from "@/lib/access";
import { Avatar, Flash } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { blockProfile, sendMessage } from "../actions";
import { reportTarget } from "../../saved/actions";

export default async function Conversation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const c = await db.conversation.findUnique({ where: { id }, include: { participants: { include: { profile: true } }, messages: { orderBy: { createdAt: "asc" }, take: 300 } } });
  if (!c) notFound();
  if (c.dealId) redirect(`/app/deals/${c.dealId}`);
  let mine = null;
  for (const p of c.participants) if (await canActFor(user.id, p.profileId, false)) { mine = p; break; }
  if (!mine) redirect("/app/messages?err=Not+authorised");
  await db.conversationParticipant.update({ where: { id: mine.id }, data: { lastReadAt: new Date() } });
  const other = c.participants.find((p) => p.id !== mine.id)?.profile;
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Avatar src={other?.avatarUrl} name={other?.displayName ?? "?"} size={40} /><div><Link href={`/p/${other?.slug}`} className="link font-medium">{other?.displayName}</Link><div className="text-xs text-muted">{other?.type.toLowerCase()}</div></div></div>
        {other && <Link href={`/app/deals/new?to=${other.id}`} className="btn-secondary btn-sm">Make a proposal</Link>}
      </div>
      <Flash sp={sp} />
      <div className="card-pad space-y-3">
        {c.messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.senderProfileId === mine.profileId ? "ms-auto bg-ink text-paper" : "bg-paper"}`}>
            <div className="whitespace-pre-line">{m.flaggedSpam && m.senderProfileId !== mine.profileId ? <span className="italic text-muted">Message held for review</span> : m.body}</div>
            <div className={`mt-1 text-[11px] ${m.senderProfileId === mine.profileId ? "text-paper/60" : "text-muted"}`}>{formatDateTime(m.createdAt, user.timezone)}</div>
          </div>
        ))}
        {!c.messages.length && <p className="text-sm text-muted">Say hello — keep it specific about what you'd like to do together.</p>}
        <form action={sendMessage} className="flex gap-2 border-t border-line pt-4">
          <input type="hidden" name="conversationId" value={c.id} />
          <textarea name="body" className="input !min-h-[44px] flex-1" rows={2} required placeholder="Write a message…" />
          <button className="btn-primary self-end">Send</button>
        </form>
      </div>
      {other && (
        <div className="mt-4 flex gap-4 text-xs text-muted">
          <form action={blockProfile}><input type="hidden" name="target" value={other.id} /><button className="underline">Block {other.displayName}</button></form>
          <form action={reportTarget}><input type="hidden" name="targetType" value="PROFILE" /><input type="hidden" name="targetId" value={other.id} /><input type="hidden" name="reason" value="Spam or scam" /><input type="hidden" name="back" value={`/app/messages/${c.id}`} /><button className="underline">Report as spam</button></form>
        </div>
      )}
    </div>
  );
}
