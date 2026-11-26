import Link from "next/link";
import { db } from "@/lib/db";
import { requireActing } from "@/lib/access";
import { Avatar, Empty, Flash, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

export default async function Messages({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { acting, user } = await requireActing();
  const parts = await db.conversationParticipant.findMany({
    where: { profileId: acting.id },
    include: { conversation: { include: { participants: { include: { profile: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 }, deal: { select: { title: true } } } } },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 100,
  });
  return (
    <div>
      <PageHeader title="Messages" sub={`Conversations for ${acting.displayName}`} />
      <Flash sp={sp} />
      {parts.length ? (
        <div className="card divide-y divide-line">
          {parts.map((p) => {
            const other = p.conversation.participants.find((x) => x.profileId !== acting.id)?.profile;
            const last = p.conversation.messages[0];
            const unread = last && (!p.lastReadAt || last.createdAt > p.lastReadAt) && last.senderProfileId !== acting.id;
            const href = p.conversation.dealId ? `/app/deals/${p.conversation.dealId}` : `/app/messages/${p.conversation.id}`;
            return (
              <Link key={p.id} href={href} className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-paper">
                <Avatar src={other?.avatarUrl} name={other?.displayName ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2"><span className={`truncate ${unread ? "font-semibold text-ink" : "text-ink"}`}>{other?.displayName}</span><span className="shrink-0 text-xs text-muted">{last ? formatDateTime(last.createdAt, user.timezone) : ""}</span></div>
                  <div className="truncate text-sm text-muted">{p.conversation.deal ? `${p.conversation.deal.title} · ` : ""}{last ? (last.flaggedSpam ? "Message held for review" : last.body) : "No messages yet"}</div>
                </div>
                {unread && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
              </Link>
            );
          })}
        </div>
      ) : <Empty title="No conversations yet" body="Message a profile from their page, or start a proposal." action={<Link href="/discover/podcasts" className="btn-secondary">Discover profiles</Link>} />}
    </div>
  );
}
