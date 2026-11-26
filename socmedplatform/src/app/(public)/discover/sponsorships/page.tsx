import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatAed } from "@/lib/money";
import { OFFERING_KINDS, EMIRATES, LANGUAGES } from "@/lib/taxonomy";
import { Avatar, Empty } from "@/components/ui";
import { one, type SP } from "@/lib/discovery";

export const metadata = { title: "Podcast & creator sponsorship inventory in the UAE", description: "Bookable sponsorship packages from UAE podcasts and creators with clear pricing and availability." };

export default async function Sponsorships({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where: Prisma.OfferingWhereInput = { isActive: true, profile: { status: "PUBLISHED", visibility: { not: "PRIVATE" }, type: { in: ["PODCAST", "INFLUENCER", "GUEST"] } } };
  const and: Prisma.OfferingWhereInput[] = [where];
  if (one(sp, "kind")) and.push({ kind: one(sp, "kind") });
  if (one(sp, "emirate")) and.push({ profile: { emirate: one(sp, "emirate") } });
  if (one(sp, "lang")) and.push({ profile: { languages: { has: one(sp, "lang") } } });
  if (Number(one(sp, "maxPrice")) > 0) and.push({ priceFils: { lte: Number(one(sp, "maxPrice")) * 100 } });
  const offers = await db.offering.findMany({ where: { AND: and }, include: { profile: true }, orderBy: [{ priceFils: "asc" }], take: 60 });
  const available = offers.filter((o) => o.inventoryTotal === null || o.inventoryUsed < o.inventoryTotal);
  return (
    <div className="page py-10">
      <h1 className="h2">Sponsorship inventory</h1>
      <p className="mt-2 max-w-2xl text-muted">Packages creators have published with prices. Request one directly — you'll agree final terms before paying.</p>
      <form method="get" className="card-pad mt-6 grid gap-3 sm:grid-cols-5">
        <select name="kind" defaultValue={one(sp, "kind")} className="input"><option value="">Any format</option>{Object.entries(OFFERING_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select name="emirate" defaultValue={one(sp, "emirate")} className="input"><option value="">Any emirate</option>{EMIRATES.map((e) => <option key={e}>{e}</option>)}</select>
        <select name="lang" defaultValue={one(sp, "lang")} className="input"><option value="">Any language</option>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        <input name="maxPrice" defaultValue={one(sp, "maxPrice")} className="input" placeholder="Max AED" inputMode="numeric" />
        <button className="btn-primary">Filter</button>
      </form>
      <div className="mt-6 grid gap-3">
        {available.length ? available.map((o) => (
          <Link key={o.id} href={`/p/${o.profile.slug}#offerings`} className="card flex flex-wrap items-center gap-4 p-4 no-underline hover:border-ink">
            <Avatar src={o.profile.avatarUrl} name={o.profile.displayName} size={40} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{o.title}</div>
              <div className="text-sm text-muted">{o.profile.displayName} · {OFFERING_KINDS[o.kind]?.label ?? o.kind}{o.inventoryTotal !== null ? ` · ${o.inventoryTotal - o.inventoryUsed} slot(s) left` : ""}</div>
            </div>
            <div className="text-ink">{o.priceType === "FREE" ? "Free" : o.priceType === "ON_REQUEST" ? "On request" : `${o.priceType === "FROM" ? "from " : ""}${formatAed(o.priceFils)}`}</div>
          </Link>
        )) : <Empty title="No packages match" body="Try a different format or emirate." />}
      </div>
    </div>
  );
}
