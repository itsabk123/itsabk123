/**
 * Explainable weighted matching.
 *
 * Design rules:
 *  - Deterministic and auditable: every score is a weighted sum of named dimensions with human-readable reasons.
 *  - Missing data never silently counts as a pass or fail: it scores neutral (0.5) and is surfaced as "missing".
 *  - Protected / sensitive attributes (gender, nationality, religion, age of the creator) are NOT inputs. The types
 *    below make that structural: there is no field for them.
 *  - Weights come from PlatformConfig and are meant to be re-tuned from outcome data (see /admin/liquidity).
 */

export type Weights = { audience: number; industry: number; geography: number; quality: number; budget: number; content: number; availability: number };
export type Dimension = keyof Weights;

export type Candidate = {
  id: string;
  type: "BRAND" | "PODCAST" | "GUEST" | "INFLUENCER" | "AGENCY";
  industry: string | null;
  niches: string[];
  topics: string[];
  languages: string[];
  emirate: string | null;
  serviceAreas: string[];
  audienceGeo: { bucket: string; share: number }[];
  audienceInterests: string[];
  reach: number | null; // largest verified-or-reported audience figure
  engagementRate: number | null;
  verified: boolean;
  reviewAvg: number | null;
  reviewCount: number;
  completedDeals: number;
  priceFromFils: number | null;
  hasFreeOption: boolean;
  offerKinds: string[];
  contentFormats: string[];
  openToRequests: boolean | null; // guestBookingOpen / has active offerings / has availability
  lastActiveDays: number;
};

export type MatchContext = {
  industry: string | null;
  categories: string[];
  topics: string[];
  languages: string[];
  emirates: string[];
  budgetMinFils: number | null;
  budgetMaxFils: number | null;
  contentFormats: string[];
  wantedKinds: string[];
  minAudience: number | null;
};

export type MatchResult = {
  candidateId: string;
  score: number; // 0..100
  dimensions: Record<Dimension, number | null>;
  reasons: string[];
  concerns: string[];
  missing: string[];
  suggestedFormat: string | null;
  confidence: "high" | "medium" | "low";
};

const norm = (s: string) => s.trim().toLowerCase();
const overlap = (a: string[], b: string[]) => {
  const bs = new Set(b.map(norm));
  return a.filter((x) => bs.has(norm(x)));
};

const FORMAT_BY_KIND: Record<string, string[]> = {
  PRE_ROLL: ["Audio ad"], MID_ROLL: ["Audio ad"], POST_ROLL: ["Audio ad"], HOST_READ: ["Audio ad"],
  SPONSORED_EPISODE: ["Interview", "Long-form video"], SPONSORED_INTERVIEW: ["Interview"], BRANDED_SEGMENT: ["Audio ad", "Video ad"],
  VIDEO_SPONSORSHIP: ["Video ad", "Long-form video"], SOCIAL_CLIPS: ["Short-form video"], NEWSLETTER: ["Newsletter"],
  SPONSORED_POST: ["Static post"], SPONSORED_STORY: ["Story"], REEL: ["Short-form video"], TIKTOK_VIDEO: ["Short-form video"],
  YOUTUBE_INTEGRATION: ["Long-form video", "Video ad"], YOUTUBE_DEDICATED: ["Long-form video"], LINKEDIN_POST: ["Static post"],
  PRODUCT_REVIEW: ["Written review", "Short-form video"], UGC_VIDEO: ["Short-form video"], EVENT_APPEARANCE: ["Event"],
  EVENT_SPONSORSHIP: ["Event"], GUEST_APPEARANCE: ["Interview"], SPEAKING: ["Event", "Interview"], AMBASSADOR: ["Static post", "Short-form video"],
};
export const formatsForKinds = (kinds: string[]) => [...new Set(kinds.flatMap((k) => FORMAT_BY_KIND[k] ?? []))];

export function scoreCandidate(ctx: MatchContext, c: Candidate, weights: Weights): MatchResult {
  const reasons: string[] = [];
  const concerns: string[] = [];
  const missing: string[] = [];
  const d: Record<Dimension, number | null> = { audience: null, industry: null, geography: null, quality: null, budget: null, content: null, availability: null };

  // Audience relevance: where the audience is and what language it consumes in.
  {
    const parts: number[] = [];
    if (c.audienceGeo.length && ctx.emirates.length) {
      const share = c.audienceGeo
        .filter((g) => ctx.emirates.map(norm).includes(norm(g.bucket)) || ["uae", "united arab emirates"].includes(norm(g.bucket)))
        .reduce((s, g) => s + g.share, 0);
      parts.push(Math.min(1, share / 50));
      if (share >= 40) reasons.push(`${Math.round(share)}% of audience in target area`);
      else if (share < 15) concerns.push(`Only ${Math.round(share)}% of audience in target area`);
    } else if (!c.audienceGeo.length) missing.push("Audience geography");
    if (ctx.languages.length) {
      const langs = overlap(ctx.languages, c.languages);
      parts.push(langs.length ? 1 : 0);
      if (langs.length) reasons.push(`Creates in ${langs.join(", ").toUpperCase()}`);
      else concerns.push("No shared content language");
    }
    if (c.audienceInterests.length && (ctx.categories.length || ctx.industry)) {
      const hits = overlap([...ctx.categories, ...(ctx.industry ? [ctx.industry] : [])], c.audienceInterests);
      parts.push(hits.length ? 1 : 0.3);
      if (hits.length) reasons.push(`Audience interested in ${hits.slice(0, 2).join(", ")}`);
    }
    d.audience = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  }

  // Industry / topic relevance.
  {
    const wanted = [...(ctx.industry ? [ctx.industry] : []), ...ctx.categories, ...ctx.topics];
    const have = [...(c.industry ? [c.industry] : []), ...c.niches, ...c.topics];
    if (!wanted.length) d.industry = null;
    else if (!have.length) missing.push("Industry / niche");
    else {
      const hits = overlap(wanted, have);
      d.industry = Math.min(1, hits.length / Math.min(2, wanted.length));
      if (hits.length) reasons.push(`Covers ${hits.slice(0, 3).join(", ")}`);
      else concerns.push("Different industry focus");
    }
  }

  // Geography: where the creator is based / operates.
  {
    const where = [c.emirate, ...c.serviceAreas].filter(Boolean) as string[];
    if (!where.length) missing.push("Location");
    else if (!ctx.emirates.length) d.geography = 0.8;
    else if (overlap(ctx.emirates, where).length || where.map(norm).includes("all uae")) {
      d.geography = 1;
      reasons.push(`Based in ${c.emirate ?? where[0]}`);
    } else d.geography = 0.5;
  }

  // Quality & trust signals. Engagement outliers lower the score but are never treated as proof of fraud.
  {
    let s = 0;
    let w = 0;
    s += c.verified ? 0.3 : 0; w += 0.3;
    if (c.verified) reasons.push("Verified profile");
    if (c.engagementRate !== null) {
      const er = c.engagementRate;
      const erScore = er > 25 ? 0.3 : er >= 1 ? Math.min(1, 0.6 + er / 15) : 0.4;
      s += 0.3 * erScore; w += 0.3;
      if (er > 25) concerns.push("Unusually high engagement — figures unverified");
    }
    if (c.reviewCount > 0 && c.reviewAvg !== null) {
      s += 0.25 * (c.reviewAvg / 5); w += 0.25;
      if (c.reviewAvg >= 4.5) reasons.push(`Rated ${c.reviewAvg.toFixed(1)}/5 by ${c.reviewCount} partner${c.reviewCount > 1 ? "s" : ""}`);
    }
    s += 0.15 * Math.min(1, c.completedDeals / 5); w += 0.15;
    d.quality = w > 0.45 ? s / w : null;
    if (d.quality === null) missing.push("Performance history");
  }

  // Budget compatibility.
  {
    if (ctx.budgetMaxFils === null && ctx.budgetMinFils === null) d.budget = null;
    else if (c.priceFromFils === null) {
      if (c.hasFreeOption) d.budget = 1;
      else missing.push("Pricing");
    } else {
      const max = ctx.budgetMaxFils ?? ctx.budgetMinFils ?? 0;
      if (c.priceFromFils <= max) { d.budget = 1; reasons.push("Within budget"); }
      else if (c.priceFromFils <= max * 1.25) { d.budget = 0.5; concerns.push("Slightly above budget"); }
      else { d.budget = 0.1; concerns.push("Above stated budget"); }
    }
  }

  // Content / format compatibility.
  let suggestedFormat: string | null = null;
  {
    const theirFormats = [...new Set([...c.contentFormats, ...formatsForKinds(c.offerKinds)])];
    if (ctx.wantedKinds.length && c.offerKinds.length) {
      const k = overlap(ctx.wantedKinds, c.offerKinds);
      if (k.length) suggestedFormat = k[0];
    }
    if (!ctx.contentFormats.length && !ctx.wantedKinds.length) d.content = null;
    else if (!theirFormats.length && !c.offerKinds.length) missing.push("Offered formats");
    else {
      const f = overlap(ctx.contentFormats, theirFormats);
      const k = overlap(ctx.wantedKinds, c.offerKinds);
      const denom = Math.max(1, Math.min(2, ctx.contentFormats.length + ctx.wantedKinds.length));
      d.content = Math.min(1, (f.length + k.length) / denom);
      if (f.length) reasons.push(`Offers ${f.slice(0, 2).join(", ").toLowerCase()}`);
    }
    if (!suggestedFormat && c.offerKinds.length) suggestedFormat = c.offerKinds[0];
  }

  // Availability & responsiveness.
  {
    const recency = c.lastActiveDays <= 14 ? 1 : c.lastActiveDays <= 45 ? 0.7 : c.lastActiveDays <= 120 ? 0.4 : 0.15;
    d.availability = c.openToRequests === false ? recency * 0.4 : recency;
    if (c.lastActiveDays > 90) concerns.push("Not active recently");
  }

  if (ctx.minAudience && c.reach !== null && c.reach < ctx.minAudience) concerns.push("Audience below campaign minimum");
  if (ctx.minAudience && c.reach === null) missing.push("Audience size");

  let num = 0;
  let den = 0;
  let present = 0;
  for (const key of Object.keys(weights) as Dimension[]) {
    const w = Math.max(0, weights[key]);
    if (!w) continue;
    const v = d[key];
    num += w * (v ?? 0.5);
    den += w;
    if (v !== null) present += w;
  }
  let score = den ? Math.round((num / den) * 100) : 0;
  if (ctx.minAudience && c.reach !== null && c.reach < ctx.minAudience) score = Math.round(score * 0.85);
  const coverage = den ? present / den : 0;

  return {
    candidateId: c.id,
    score,
    dimensions: d,
    reasons: [...new Set(reasons)].slice(0, 5),
    concerns: [...new Set(concerns)].slice(0, 4),
    missing: [...new Set(missing)],
    suggestedFormat,
    confidence: coverage >= 0.75 ? "high" : coverage >= 0.5 ? "medium" : "low",
  };
}

export function rankCandidates(ctx: MatchContext, candidates: Candidate[], weights: Weights, exclude: Set<string> = new Set()) {
  return candidates
    .filter((c) => !exclude.has(c.id))
    .map((c) => scoreCandidate(ctx, c, weights))
    .sort((a, b) => b.score - a.score);
}
