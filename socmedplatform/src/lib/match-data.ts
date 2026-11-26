import "server-only";
import type { Campaign, Prisma, Profile, ProfileType } from "@prisma/client";
import { db } from "./db";
import { getConfig } from "./config";
import { rankCandidates, type Candidate, type MatchContext, type MatchResult } from "./matching";

export const candidateInclude = {
  podcast: true,
  guest: true,
  influencer: true,
  brand: true,
  socialAccounts: true,
  metrics: true,
  audience: true,
  offerings: { where: { isActive: true } },
  availability: { select: { id: true } },
  reviewsReceived: { where: { state: "PUBLISHED" }, select: { rating: true } },
  _count: { select: { dealsReceived: { where: { status: "COMPLETED" } }, dealsInitiated: { where: { status: "COMPLETED" } } } },
} satisfies Prisma.ProfileInclude;

export type CandidateProfile = Prisma.ProfileGetPayload<{ include: typeof candidateInclude }>;

export function reachOf(p: CandidateProfile): number | null {
  const vals = [
    ...p.socialAccounts.map((s) => s.followers ?? 0),
    ...p.metrics.filter((m) => /downloads|listens|views/.test(m.key)).map((m) => m.value),
  ].filter((v) => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

export function engagementOf(p: CandidateProfile): number | null {
  const ers = p.socialAccounts.map((s) => s.engagementRate).filter((v): v is number => typeof v === "number");
  return ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : null;
}

export function toCandidate(p: CandidateProfile): Candidate {
  const ratings = p.reviewsReceived.map((r) => r.rating);
  const priced = p.offerings.filter((o) => o.priceFils !== null && o.priceType !== "FREE").map((o) => o.priceFils as number);
  return {
    id: p.id,
    type: p.type,
    industry: p.industry,
    niches: [...p.niches, ...p.subIndustries, ...(p.guest?.expertise ?? []), ...(p.influencer?.preferredCategories ?? [])],
    topics: p.guest?.topics ?? [],
    languages: p.languages,
    emirate: p.emirate,
    serviceAreas: p.serviceAreas,
    audienceGeo: p.audience.filter((a) => a.dimension === "GEO").map((a) => ({ bucket: a.bucket, share: a.share })),
    audienceInterests: p.audience.filter((a) => a.dimension === "INTEREST").map((a) => a.bucket),
    reach: reachOf(p),
    engagementRate: engagementOf(p),
    verified: !!p.verifiedAt,
    reviewAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    reviewCount: ratings.length,
    completedDeals: p._count.dealsReceived + p._count.dealsInitiated,
    priceFromFils: priced.length ? Math.min(...priced) : p.priceFromFils,
    hasFreeOption: p.offerings.some((o) => o.priceType === "FREE") || (p.guest?.appearanceTypes ?? []).includes("FREE_EXPERT"),
    offerKinds: p.offerings.map((o) => o.kind),
    contentFormats: p.influencer?.contentFormats ?? [],
    openToRequests:
      p.type === "PODCAST" ? p.podcast?.guestBookingOpen || p.offerings.length > 0 : p.offerings.length > 0 || p.availability.length > 0 || null,
    lastActiveDays: Math.floor((Date.now() - p.lastActiveAt.getTime()) / 86400_000),
  };
}

export function contextFromCampaign(c: Campaign): MatchContext {
  return {
    industry: c.industry,
    categories: c.categories,
    topics: [],
    languages: c.languages,
    emirates: c.targetEmirates,
    budgetMinFils: c.budgetMinFils,
    budgetMaxFils: c.budgetMaxFils,
    contentFormats: c.contentFormats,
    wantedKinds: [],
    minAudience: c.minAudience,
  };
}

/** Builds what a profile is looking for from its own data (used for the personalised feed). */
export async function contextFromProfile(p: Profile): Promise<MatchContext> {
  const full = await db.profile.findUnique({ where: { id: p.id }, include: { brand: true, guest: true, podcast: true } });
  return {
    industry: full?.industry ?? null,
    categories: [...(full?.niches ?? []), ...(full?.brand?.productCategories ?? []), ...(full?.guest?.preferredCategories ?? [])],
    topics: full?.type === "PODCAST" ? full.niches : full?.guest?.topics ?? [],
    languages: full?.languages ?? [],
    emirates: full?.brand?.targetGeographies?.length ? full.brand.targetGeographies : full?.emirate ? [full.emirate] : [],
    budgetMinFils: full?.brand?.budgetMinFils ?? null,
    budgetMaxFils: full?.brand?.budgetMaxFils ?? null,
    contentFormats: [],
    wantedKinds: [],
    minAudience: null,
  };
}

export async function findMatches(opts: {
  ctx: MatchContext;
  types: ProfileType[];
  excludeProfileIds?: string[];
  feedbackSourceId?: string;
  limit?: number;
}): Promise<{ result: MatchResult; profile: CandidateProfile }[]> {
  const weights = await getConfig("matchWeights");
  const hidden = opts.feedbackSourceId
    ? (await db.matchFeedback.findMany({ where: { sourceProfileId: opts.feedbackSourceId, signal: "HIDE" }, select: { targetProfileId: true } })).map((h) => h.targetProfileId)
    : [];
  const blocked = opts.feedbackSourceId
    ? (await db.block.findMany({ where: { OR: [{ blockerProfileId: opts.feedbackSourceId }, { blockedProfileId: opts.feedbackSourceId }] } })).flatMap((b) => [b.blockerProfileId, b.blockedProfileId])
    : [];
  const exclude = new Set([...(opts.excludeProfileIds ?? []), ...hidden, ...blocked]);
  // Prefilter in SQL to keep the scoring set bounded; scoring itself is in-process and explainable.
  const profiles = await db.profile.findMany({
    where: { type: { in: opts.types }, status: "PUBLISHED", visibility: { not: "PRIVATE" }, id: { notIn: [...exclude] } },
    include: candidateInclude,
    orderBy: { lastActiveAt: "desc" },
    take: 400,
  });
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const ranked = rankCandidates(opts.ctx, profiles.map(toCandidate), weights, exclude);
  return ranked.slice(0, opts.limit ?? 12).map((result) => ({ result, profile: byId.get(result.candidateId)! }));
}
