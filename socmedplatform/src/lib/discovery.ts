import "server-only";
import type { Prisma, ProfileType } from "@prisma/client";
import { db } from "./db";
import { candidateInclude, engagementOf, reachOf, toCandidate, contextFromProfile, type CandidateProfile } from "./match-data";
import { scoreCandidate, type MatchResult } from "./matching";
import { getConfig } from "./config";
import type { Profile } from "@prisma/client";

export type SP = Record<string, string | string[] | undefined>;
export const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() || "";
};

export const TYPE_BY_PATH: Record<string, ProfileType> = { podcasts: "PODCAST", influencers: "INFLUENCER", guests: "GUEST", brands: "BRAND", agencies: "AGENCY" };

export const SORTS = {
  relevance: "Relevance",
  best: "Best match for me",
  reach: "Audience reach",
  engagement: "Engagement",
  price_asc: "Price: low to high",
  rating: "Rating",
  active: "Recently active",
  newest: "Recently joined",
  verified: "Verified first",
} as const;

export function buildWhere(type: ProfileType, sp: SP): Prisma.ProfileWhereInput {
  const and: Prisma.ProfileWhereInput[] = [{ type, status: "PUBLISHED", visibility: { not: "PRIVATE" } }];
  const q = one(sp, "q");
  if (q) {
    and.push({
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { headline: { contains: q, mode: "insensitive" } },
        { bio: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
        { niches: { has: q } },
        { guest: { topics: { has: q } } },
        { guest: { expertise: { has: q } } },
      ],
    });
  }
  const emirate = one(sp, "emirate");
  if (emirate) and.push({ OR: [{ emirate }, { serviceAreas: { has: emirate } }] });
  const city = one(sp, "city");
  if (city) and.push({ city: { contains: city, mode: "insensitive" } });
  const lang = one(sp, "lang");
  if (lang) and.push({ languages: { has: lang } });
  const industry = one(sp, "industry");
  if (industry) and.push({ OR: [{ industry }, { niches: { has: industry } }] });
  const niche = one(sp, "niche");
  if (niche) and.push({ niches: { has: niche } });
  const platform = one(sp, "platform");
  if (platform) and.push({ socialAccounts: { some: { platform } } });
  const minReach = Number(one(sp, "minReach"));
  if (minReach > 0) and.push({ OR: [{ socialAccounts: { some: { followers: { gte: minReach } } } }, { metrics: { some: { key: { in: ["monthly_downloads", "monthly_video_views"] }, value: { gte: minReach } } } }] });
  const minEr = Number(one(sp, "minEr"));
  if (minEr > 0) and.push({ socialAccounts: { some: { engagementRate: { gte: minEr } } } });
  const maxPrice = Number(one(sp, "maxPrice"));
  if (maxPrice > 0) and.push({ offerings: { some: { isActive: true, OR: [{ priceFils: { lte: maxPrice * 100 } }, { priceType: "FREE" }] } } });
  const format = one(sp, "format");
  if (format) and.push({ offerings: { some: { kind: format, isActive: true } } });
  if (one(sp, "verified") === "1") and.push({ verifiedAt: { not: null } });
  if (one(sp, "audienceSource") === "verified") and.push({ socialAccounts: { some: { source: "API_VERIFIED" } } });
  const appearance = one(sp, "appearance");
  if (appearance) and.push({ guest: { appearanceTypes: { has: appearance } } });
  const seniority = one(sp, "seniority");
  if (seniority) and.push({ guest: { seniority } });
  if (one(sp, "guestBooking") === "1") and.push({ podcast: { guestBookingOpen: true } });
  const podFormat = one(sp, "podFormat");
  if (podFormat) and.push({ podcast: { format: { in: podFormat === "VIDEO" ? ["VIDEO", "BOTH"] : podFormat === "AUDIO" ? ["AUDIO", "BOTH"] : [podFormat] } } });
  const audienceType = one(sp, "audienceType");
  if (audienceType) and.push({ brand: { audienceType } });
  if (one(sp, "available") === "1") and.push({ OR: [{ availability: { some: {} } }, { podcast: { guestBookingOpen: true } }] });
  const activeDays = Number(one(sp, "activeDays"));
  if (activeDays > 0) and.push({ lastActiveAt: { gte: new Date(Date.now() - activeDays * 86400_000) } });
  return { AND: and };
}

export type DiscoveryItem = { profile: CandidateProfile; reach: number | null; er: number | null; rating: number | null; match: MatchResult | null; featured: boolean };

export async function discover(type: ProfileType, sp: SP, acting: Profile | null) {
  const where = buildWhere(type, sp);
  const rows = await db.profile.findMany({ where, include: candidateInclude, take: 300, orderBy: { lastActiveAt: "desc" } });
  let sort = (one(sp, "sort") || (acting ? "best" : "relevance")) as keyof typeof SORTS;
  if (!(sort in SORTS)) sort = "relevance";
  if (sort === "best" && !acting) sort = "relevance";

  let ctx = null;
  if (acting && (sort === "best" || sort === "relevance")) ctx = await contextFromProfile(acting);
  const weights = await getConfig("matchWeights");
  const now = new Date();
  const items: DiscoveryItem[] = rows
    .filter((p) => p.id !== acting?.id)
    .map((p) => {
      const ratings = p.reviewsReceived.map((r) => r.rating);
      return {
        profile: p,
        reach: reachOf(p),
        er: engagementOf(p),
        rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        match: ctx ? scoreCandidate(ctx, toCandidate(p), weights) : null,
        featured: !!p.featuredUntil && p.featuredUntil > now,
      };
    });

  const cmp: Record<string, (a: DiscoveryItem, b: DiscoveryItem) => number> = {
    relevance: (a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0) || +!!b.profile.verifiedAt - +!!a.profile.verifiedAt || b.profile.completeness - a.profile.completeness,
    best: (a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0),
    reach: (a, b) => (b.reach ?? -1) - (a.reach ?? -1),
    engagement: (a, b) => (b.er ?? -1) - (a.er ?? -1),
    price_asc: (a, b) => (toCandidate(a.profile).priceFromFils ?? 9e15) - (toCandidate(b.profile).priceFromFils ?? 9e15),
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
    active: (a, b) => b.profile.lastActiveAt.getTime() - a.profile.lastActiveAt.getTime(),
    newest: (a, b) => b.profile.createdAt.getTime() - a.profile.createdAt.getTime(),
    verified: (a, b) => +!!b.profile.verifiedAt - +!!a.profile.verifiedAt,
  };
  items.sort(cmp[sort]);
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  const per = 24;
  // Paid placements are shown in a separate, labelled strip — never mixed into organic ranking.
  const featured = items.filter((i) => i.featured).slice(0, 3);
  return { items: items.slice((page - 1) * per, page * per), total: items.length, page, pages: Math.max(1, Math.ceil(items.length / per)), sort, featured };
}
