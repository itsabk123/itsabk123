import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/site-chrome";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [["/admin", "Overview"], ["/admin/liquidity", "Marketplace health"], ["/admin/users", "Users & profiles"], ["/admin/verification", "Verification"], ["/admin/moderation", "Trust & safety"], ["/admin/finance", "Finance"], ["/admin/config", "Pricing & config"], ["/admin/content", "Content"], ["/admin/audit", "Audit & system"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin(["MODERATOR", "FINANCE"]);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-line bg-ink text-paper lg:sticky lg:top-0 lg:h-screen lg:border-0">
        <div className="flex h-16 items-center px-4 [&_*]:!text-paper [&_span.border-ink]:!border-paper"><Logo /></div>
        <div className="px-4 pb-2 text-xs uppercase tracking-wide text-paper/50">Admin · {user.platformRole.toLowerCase()}</div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:block">
          {NAV.map(([h, l]) => <Link key={h} href={h} className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-paper/80 no-underline hover:bg-paper/10 hover:text-paper">{l}</Link>)}
          <Link href="/app" className="mt-4 block rounded-lg px-3 py-1.5 text-sm text-paper/50 no-underline hover:text-paper">← Back to app</Link>
        </nav>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
