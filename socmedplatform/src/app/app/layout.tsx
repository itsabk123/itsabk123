import Link from "next/link";
import { requireUser, hasPlatformRole } from "@/lib/auth";
import { getActingContext } from "@/lib/access";
import { db } from "@/lib/db";
import { Logo } from "@/components/site-chrome";
import { logout, switchProfile } from "@/app/actions";
import { PROFILE_TYPE_META } from "@/lib/taxonomy";
import { resendVerification } from "@/app/auth-actions";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  const ctx = await getActingContext();
  const acting = ctx?.acting ?? null;
  const [unreadNotes, convos, pendingDeals] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    acting ? db.conversationParticipant.findMany({ where: { profileId: acting.id }, include: { conversation: { select: { lastMessageAt: true } } } }) : [],
    acting ? db.deal.count({ where: { recipientProfileId: acting.id, status: "PROPOSED" } }) : 0,
  ]);
  const unreadMsgs = convos.filter((c) => !c.lastReadAt || c.conversation.lastMessageAt > c.lastReadAt).length;
  const isBrandSide = acting && (acting.type === "BRAND" || acting.type === "AGENCY");
  const nav: { href: string; label: string; badge?: number; show?: boolean }[] = [
    { href: "/app", label: "Home" },
    { href: "/app/campaigns", label: "Campaigns", show: !!isBrandSide },
    { href: "/app/opportunities", label: "Opportunities", show: !!acting && !isBrandSide },
    { href: "/app/deals", label: "Deals", badge: pendingDeals },
    { href: "/app/messages", label: "Messages", badge: unreadMsgs },
    { href: "/app/bookings", label: "Bookings" },
    { href: "/app/crm", label: "Contacts" },
    { href: "/app/saved", label: "Saved" },
    { href: "/app/analytics", label: "Performance" },
    { href: "/app/finance", label: "Payments" },
    { href: "/app/assistant", label: "Writing assistant" },
    { href: "/app/profiles", label: "My profiles" },
    { href: "/app/team", label: "Team & organizations" },
    { href: "/app/notifications", label: "Notifications", badge: unreadNotes },
    { href: "/app/settings", label: "Settings" },
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-e">
        <div className="flex h-16 items-center justify-between px-4"><Logo /><Link href="/discover/podcasts" className="btn-ghost btn-sm lg:hidden">Discover</Link></div>
        {ctx && ctx.profiles.length > 0 && (
          <form action={switchProfile} className="px-4 pb-3">
            <label className="stat-label" htmlFor="profileId">Acting as</label>
            <div className="mt-1 flex gap-1">
              <select id="profileId" name="profileId" defaultValue={acting?.id} className="input !min-h-[36px] !py-1 text-sm">
                {ctx.profiles.map((p) => <option key={p.id} value={p.id}>{p.displayName} · {PROFILE_TYPE_META[p.type].label}</option>)}
              </select>
              <button className="btn-secondary btn-sm">Switch</button>
            </div>
          </form>
        )}
        <details className="lg:hidden" >
          <summary className="cursor-pointer list-none px-4 pb-3 text-sm text-ink">Menu ▾</summary>
          <NavList nav={nav} />
        </details>
        <div className="hidden lg:block"><NavList nav={nav} /></div>
        <div className="space-y-1 border-t border-line px-4 py-4 text-sm">
          <Link href="/discover/podcasts" className="block text-muted no-underline hover:text-ink">Discover marketplace →</Link>
          {hasPlatformRole(user, ["MODERATOR", "FINANCE"]) && <Link href="/admin" className="block text-muted no-underline hover:text-ink">Admin console →</Link>}
          <form action={logout}><button className="text-muted hover:text-ink">Log out</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        {!user.emailVerifiedAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-gold-soft px-4 py-2 text-sm sm:px-8">
            <span>Confirm your email ({user.email}) to send proposals and make payments.</span>
            <form action={resendVerification}><button className="btn-secondary btn-sm">Resend link</button></form>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavList({ nav }: { nav: { href: string; label: string; badge?: number; show?: boolean }[] }) {
  return (
    <nav className="px-2 pb-4">
      {nav.filter((n) => n.show !== false).map((n) => (
        <Link key={n.href} href={n.href} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-charcoal no-underline hover:bg-paper hover:text-ink">
          {n.label}
          {!!n.badge && <span className="rounded-full bg-ink px-1.5 text-[11px] text-paper">{n.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
