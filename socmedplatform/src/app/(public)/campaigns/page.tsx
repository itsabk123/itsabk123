import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { db } from "@/lib/db";
import { CampaignCard } from "@/components/campaign-card";
import { Empty } from "@/components/ui";
import { EMIRATES, INDUSTRIES, LANGUAGES, CAMPAIGN_OBJECTIVES } from "@/lib/taxonomy";
import { one, type SP } from "@/lib/discovery";

export const metadata = { title: "Brand campaigns & creator opportunities in the UAE", description: "Open campaigns from brands looking for podcasts, influencers and expert guests across the UAE.", alternates: { canonical: "/campaigns" } };

export default async function Campaigns({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const and: Prisma.CampaignWhereInput[] = [{ status: "OPEN", visibility: "PUBLIC" }];
  if (one(sp, "q")) and.push({ OR: [{ name: { contains: one(sp, "q"), mode: "insensitive" } }, { product: { contains: one(sp, "q"), mode: "insensitive" } }] });
  if (one(sp, "emirate")) and.push({ OR: [{ targetEmirates: { has: one(sp, "emirate") } }, { targetEmirates: { isEmpty: true } }] });
  if (one(sp, "lang")) and.push({ languages: { has: one(sp, "lang") } });
  if (one(sp, "industry")) and.push({ industry: one(sp, "industry") });
  if (one(sp, "objective")) and.push({ objective: one(sp, "objective") });
  if (one(sp, "type")) and.push({ creatorTypes: { has: one(sp, "type") } });
  if (Number(one(sp, "minBudget")) > 0) and.push({ budgetMaxFils: { gte: Number(one(sp, "minBudget")) * 100 } });
  const campaigns = await db.campaign.findMany({ where: { AND: and }, include: { brand: true }, orderBy: { createdAt: "desc" }, take: 60 });
  const s = (name: string, opts: readonly string[] | [string, string][], label: string) => (
    <select name={name} defaultValue={one(sp, name)} className="input" aria-label={label}>
      <option value="">{label}</option>
      {opts.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
    </select>
  );
  return (
    <div className="page py-10">
      <h1 className="h2">Campaigns</h1>
      <p className="mt-2 max-w-2xl text-muted">Brands looking for creators, podcasts and guests. Apply with a proposal — you agree final terms before any work starts.</p>
      <form method="get" className="card-pad mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <input name="q" defaultValue={one(sp, "q")} className="input lg:col-span-2" placeholder="Search campaigns" />
        {s("type", [["PODCAST", "Podcasts"], ["INFLUENCER", "Influencers"], ["GUEST", "Guests"]], "Creator type")}
        {s("emirate", EMIRATES, "Emirate")}
        {s("lang", LANGUAGES.map((l) => [l.code, l.label] as [string, string]), "Language")}
        {s("objective", CAMPAIGN_OBJECTIVES, "Objective")}
        {s("industry", INDUSTRIES, "Industry")}
        <input name="minBudget" defaultValue={one(sp, "minBudget")} inputMode="numeric" className="input" placeholder="Min budget AED" />
        <button className="btn-primary">Filter</button>
        <Link href="/campaigns" className="btn-ghost">Reset</Link>
      </form>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
      </div>
      {!campaigns.length && <Empty title="No open campaigns match" body="Save a search from Discover to get alerted when new campaigns appear." />}
    </div>
  );
}
