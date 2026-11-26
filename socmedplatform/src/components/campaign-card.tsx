import Link from "next/link";
import type { Campaign, Profile } from "@prisma/client";
import { formatAed } from "@/lib/money";
import { formatDate } from "@/lib/time";

export function budgetLabel(c: Pick<Campaign, "budgetMinFils" | "budgetMaxFils">) {
  if (c.budgetMinFils && c.budgetMaxFils) return `${formatAed(c.budgetMinFils)} – ${formatAed(c.budgetMaxFils)}`;
  if (c.budgetMaxFils) return `Up to ${formatAed(c.budgetMaxFils)}`;
  if (c.budgetMinFils) return `From ${formatAed(c.budgetMinFils)}`;
  return "Budget on request";
}

export function CampaignCard({ c }: { c: Campaign & { brand: Profile } }) {
  return (
    <Link href={`/campaigns/${c.slug}`} className="card flex flex-col p-5 no-underline hover:border-ink">
      <div className="text-xs text-muted">{c.brand.displayName}{c.isDemo && <span className="badge-warn ms-2">Demo</span>}</div>
      <div className="h3 mt-1">{c.name}</div>
      <div className="mt-1 text-sm text-muted">{c.objective}{c.targetEmirates.length ? ` · ${c.targetEmirates.slice(0, 2).join(", ")}` : " · All UAE"}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.creatorTypes.map((t) => <span key={t} className="badge">{t === "PODCAST" ? "Podcasts" : t === "GUEST" ? "Guests" : "Influencers"}</span>)}
        {c.recurring && <span className="badge-gold">Recurring</span>}
      </div>
      <div className="mt-auto flex justify-between border-t border-line pt-3 text-sm">
        <span className="text-ink">{budgetLabel(c)}</span>
        <span className="text-xs text-muted">{c.endDate ? `Ends ${formatDate(c.endDate)}` : "Open"}</span>
      </div>
    </Link>
  );
}
