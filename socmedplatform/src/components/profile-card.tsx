import Link from "next/link";
import { Avatar, ScoreRing, SourceTag } from "./ui";
import { formatAed, formatNumber } from "@/lib/money";
import { PROFILE_TYPE_META, languageLabel } from "@/lib/taxonomy";
import type { DiscoveryItem } from "@/lib/discovery";
import { toCandidate } from "@/lib/match-data";

export function ProfileCard({ item, showMatch = true }: { item: DiscoveryItem; showMatch?: boolean }) {
  const p = item.profile;
  const c = toCandidate(p);
  const reachSource = p.socialAccounts.find((s) => s.followers === item.reach)?.source ?? p.metrics.find((m) => m.value === item.reach)?.source;
  const subtitle =
    p.type === "GUEST" ? [p.guest?.professionalTitle, p.guest?.company].filter(Boolean).join(", ") :
    p.type === "PODCAST" ? [p.podcast?.format === "BOTH" ? "Audio + video" : p.podcast?.format === "VIDEO" ? "Video podcast" : "Audio podcast", p.podcast?.frequency].filter(Boolean).join(" · ") :
    p.headline;
  return (
    <Link href={`/p/${p.slug}`} className="card group flex flex-col gap-4 p-5 no-underline transition-colors hover:border-ink">
      <div className="flex items-start gap-3">
        <Avatar src={p.avatarUrl} name={p.displayName} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-ink">{p.displayName}</span>
            {p.verifiedAt && <span className="text-accent" title="Verified">✓</span>}
          </div>
          <div className="truncate text-sm text-muted">{subtitle || PROFILE_TYPE_META[p.type].label}</div>
          <div className="mt-1 text-xs text-muted">{[p.city || p.emirate, p.languages.slice(0, 3).map(languageLabel).join(" · ")].filter(Boolean).join(" — ")}</div>
        </div>
        {showMatch && item.match && <ScoreRing score={item.match.score} />}
      </div>
      {p.headline && p.type !== "BRAND" && <p className="line-clamp-2 text-sm text-charcoal">{p.headline}</p>}
      <div className="flex flex-wrap gap-1.5">
        {[p.industry, ...p.niches].filter(Boolean).slice(0, 3).map((n) => <span key={n} className="badge">{n}</span>)}
        {p.isDemo && <span className="badge-warn" title="Example profile for demonstration">Demo</span>}
        {p.podcast?.guestBookingOpen && <span className="badge-accent">Booking guests</span>}
        {p.guest?.appearanceTypes.includes("FREE_EXPERT") && <span className="badge-ok">Free expert</span>}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-3 text-sm">
        <div className="flex min-w-0 items-center gap-1.5">
          {item.reach ? <><span className="text-ink">{formatNumber(item.reach)}</span><span className="text-xs text-muted">{p.type === "PODCAST" ? "monthly" : "audience"}</span>{reachSource && <SourceTag source={reachSource} />}</> : <span className="text-xs text-muted">No audience data</span>}
        </div>
        <div className="whitespace-nowrap text-end text-xs text-muted">{c.priceFromFils ? <>from <span className="text-sm text-ink">{formatAed(c.priceFromFils)}</span></> : c.hasFreeOption ? "Free options" : p.type === "BRAND" ? "" : "Rates on request"}</div>
      </div>
      {showMatch && item.match && item.match.reasons.length > 0 && <div className="-mt-2 text-xs text-muted">Why: {item.match.reasons.slice(0, 2).join(" · ")}</div>}
    </Link>
  );
}
