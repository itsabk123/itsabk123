import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { setLocale } from "@/app/actions";
import { SITE } from "@/lib/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 no-underline">
      <span aria-hidden className="inline-block h-6 w-6 rounded-full border-[5px] border-ink" />
      <span className="font-serif text-xl tracking-tight text-ink">{SITE.name}</span>
    </Link>
  );
}

async function LocaleSwitch() {
  const { locale } = await t();
  const path = (await headers()).get("x-pathname") ?? "/";
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={locale === "ar" ? "en" : "ar"} />
      <input type="hidden" name="back" value={path} />
      <button className="btn-ghost btn-sm" aria-label="Switch language">{locale === "ar" ? "English" : "العربية"}</button>
    </form>
  );
}

export async function SiteHeader() {
  const [{ d }, user] = await Promise.all([t(), getCurrentUser()]);
  const nav = [
    { href: "/discover/podcasts", label: d.podcasts },
    { href: "/discover/influencers", label: d.influencers },
    { href: "/discover/guests", label: d.guests },
    { href: "/discover/brands", label: d.brands },
    { href: "/campaigns", label: d.campaigns },
    { href: "/pricing", label: d.pricing },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-sm text-charcoal no-underline hover:bg-paper-deep hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <LocaleSwitch />
          {user ? (
            <Link href="/app" className="btn-primary btn-sm">{d.dashboard}</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost btn-sm hidden sm:inline-flex">{d.login}</Link>
              <Link href="/signup" className="btn-primary btn-sm">{d.signup}</Link>
            </>
          )}
          <details className="relative lg:hidden">
            <summary className="btn-ghost btn-sm list-none" aria-label="Menu">Menu</summary>
            <div className="absolute end-0 mt-2 w-56 rounded-2xl border border-line bg-white p-2 shadow-sm">
              {[...nav, { href: "/how-it-works", label: d.howItWorks }, ...(user ? [] : [{ href: "/login", label: d.login }])].map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-xl px-3 py-2 text-sm no-underline hover:bg-paper">{n.label}</Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const { d } = await t();
  const cols = [
    { title: "Marketplace", links: [["/discover/podcasts", "Podcasts"], ["/discover/influencers", "Influencers"], ["/discover/guests", "Guests"], ["/discover/brands", "Brands"], ["/campaigns", "Campaigns"], ["/discover/sponsorships", "Sponsorship inventory"]] },
    { title: "For you", links: [["/for/brands", "For brands"], ["/for/podcast-hosts", "For podcast hosts"], ["/for/guests", "For guests"], ["/for/influencers", "For influencers"], ["/for/agencies", "For agencies"]] },
    { title: "Company", links: [["/how-it-works", "How it works"], ["/pricing", "Pricing"], ["/success-stories", "Success stories"], ["/resources", "Resources"], ["/blog", "Blog"], ["/about", "About"], ["/contact", "Contact"], ["/faq", "FAQ"]] },
    { title: "Legal", links: [["/legal/terms", "Terms"], ["/legal/privacy", "Privacy"], ["/legal/cookies", "Cookies"], ["/legal/guidelines", "Advertising & creator guidelines"], ["/legal/disputes", "Disputes & refunds"]] },
  ];
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">{d.footerNote}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">{c.title}</div>
            <ul className="space-y-2 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}><Link href={href} className="text-charcoal no-underline hover:text-ink hover:underline">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="page border-t border-line py-6 text-xs text-muted">© {new Date().getFullYear()} {SITE.name}. Prices in AED. Times shown in UAE time (GST, UTC+4) unless stated.</div>
    </footer>
  );
}
