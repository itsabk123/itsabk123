import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Empty, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

async function markAll() {
  "use server";
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/app/notifications");
}

export default async function Notifications() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" actions={<><form action={markAll}><button className="btn-secondary btn-sm">Mark all read</button></form><Link href="/app/settings#notifications" className="btn-ghost btn-sm">Preferences</Link></>} />
      {items.length ? (
        <div className="card divide-y divide-line">
          {items.map((n) => (
            <Link key={n.id} href={n.link ?? "#"} className={`block px-4 py-3 no-underline hover:bg-paper ${n.readAt ? "" : "bg-gold-soft/40"}`}>
              <div className="flex justify-between gap-2 text-sm"><span className={n.readAt ? "text-charcoal" : "font-medium text-ink"}>{n.title}</span><span className="shrink-0 text-xs text-muted">{formatDateTime(n.createdAt, user.timezone)}</span></div>
              {n.body && <div className="text-sm text-muted">{n.body}</div>}
            </Link>
          ))}
        </div>
      ) : <Empty title="You're all caught up" />}
    </div>
  );
}
