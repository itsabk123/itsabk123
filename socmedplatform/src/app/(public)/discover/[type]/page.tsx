import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discover, TYPE_BY_PATH, one, type SP } from "@/lib/discovery";
import { getActingContext } from "@/lib/access";
import { Filters } from "@/components/filters";
import { ProfileCard } from "@/components/profile-card";
import { Empty } from "@/components/ui";
import { saveSearch } from "@/app/app/saved/actions";

const COPY: Record<string, { title: string; sub: string; seo: string }> = {
  podcasts: { title: "Discover UAE podcasts", sub: "Find shows to sponsor or appear on — by emirate, language, niche, audience and format.", seo: "UAE podcasts for sponsorship and guest appearances" },
  influencers: { title: "Discover UAE creators", sub: "Influencers and UGC creators across Instagram, TikTok, YouTube, LinkedIn and more. Audience sources clearly labelled.", seo: "UAE influencers and creators for brand campaigns" },
  guests: { title: "Discover podcast guests", sub: "Founders, executives, specialists and creators available for interviews — free, paid and sponsored.", seo: "Podcast guests and experts in the UAE" },
  brands: { title: "Discover brands", sub: "Businesses on the marketplace actively looking for podcasts, creators and expert voices.", seo: "Brands sponsoring podcasts and creators in the UAE" },
  agencies: { title: "Discover agencies", sub: "Advertising, talent and podcast production agencies.", seo: "Marketing, talent and podcast agencies in the UAE" },
};

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  const c = COPY[type];
  if (!c) return {};
  return { title: c.seo, description: c.sub, alternates: { canonical: `/discover/${type}` } };
}

export default async function DiscoverPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<SP> }) {
  const { type } = await params;
  const sp = await searchParams;
  const pt = TYPE_BY_PATH[type];
  if (!pt) notFound();
  const ctx = await getActingContext();
  const res = await discover(pt, sp, ctx?.acting ?? null);
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v && k !== "page" ? [[k, v]] : [])));
  const pageHref = (n: number) => `/discover/${type}?${new URLSearchParams([...qs, ["page", String(n)]])}`;
  return (
    <div className="page py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted"><Link href="/" className="no-underline">Home</Link> / Discover / {type}</nav>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="h2">{COPY[type].title}</h1>
          <p className="mt-2 max-w-2xl text-muted">{COPY[type].sub}</p>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {Object.keys(COPY).filter((k) => k !== "agencies").map((k) => (
            <Link key={k} href={`/discover/${k}`} className={`btn-sm ${k === type ? "btn-primary" : "btn-ghost"}`}>{k[0].toUpperCase() + k.slice(1)}</Link>
          ))}
          <Link href="/discover/sponsorships" className="btn-sm btn-ghost">Sponsorships</Link>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <details className="lg:hidden" open={false}>
            <summary className="btn-secondary mb-3 w-full list-none">Filters</summary>
            <Filters type={pt} sp={sp} action={`/discover/${type}`} signedIn={!!ctx?.acting} />
          </details>
          <div className="hidden lg:block"><Filters type={pt} sp={sp} action={`/discover/${type}`} signedIn={!!ctx?.acting} /></div>
        </aside>
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>{res.total} result{res.total === 1 ? "" : "s"}{res.sort === "best" && ctx?.acting ? ` · ranked for ${ctx.acting.displayName}` : ""}</span>
            {ctx?.user ? (
              <form action={saveSearch} className="flex gap-2">
                <input type="hidden" name="scope" value={type} />
                <input type="hidden" name="query" value={qs.toString()} />
                <input type="hidden" name="name" value={`${COPY[type].title}${one(sp, "q") ? `: ${one(sp, "q")}` : ""}`} />
                <button className="btn-secondary btn-sm">Save search & alert me</button>
              </form>
            ) : (
              <Link href={`/signup?next=${encodeURIComponent(`/discover/${type}?${qs}`)}`} className="link text-sm">Sign up to see your match scores</Link>
            )}
          </div>
          {res.featured.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted">Featured · paid placement</div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{res.featured.map((i) => <ProfileCard key={`f-${i.profile.id}`} item={i} />)}</div>
            </div>
          )}
          {res.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{res.items.map((i) => <ProfileCard key={i.profile.id} item={i} />)}</div>
          ) : (
            <Empty
              title="No matches for these filters"
              body="Try removing a filter or two. If you can't find the right fit, our team offers assisted matchmaking."
              action={<div className="flex gap-2"><Link href={`/discover/${type}`} className="btn-secondary">Clear filters</Link><Link href="/contact?topic=matchmaking" className="btn-ghost">Request matchmaking</Link></div>}
            />
          )}
          {res.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {res.page > 1 && <Link href={pageHref(res.page - 1)} className="btn-secondary btn-sm">← Previous</Link>}
              <span className="text-sm text-muted">Page {res.page} of {res.pages}</span>
              {res.page < res.pages && <Link href={pageHref(res.page + 1)} className="btn-secondary btn-sm">Next →</Link>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
