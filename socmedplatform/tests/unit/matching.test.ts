import { describe, expect, it } from "vitest";
import { scoreCandidate, rankCandidates, type Candidate, type MatchContext } from "@/lib/matching";
import { DEFAULT_CONFIG } from "@/lib/config";

const W = DEFAULT_CONFIG.matchWeights;
const base: Candidate = {
  id: "c1", type: "INFLUENCER", industry: "Real estate", niches: ["Personal finance"], topics: [], languages: ["en", "ar"], emirate: "Dubai", serviceAreas: [],
  audienceGeo: [{ bucket: "Dubai", share: 55 }], audienceInterests: ["Real estate"], reach: 40000, engagementRate: 3.5, verified: true, reviewAvg: 4.8, reviewCount: 4,
  completedDeals: 5, priceFromFils: 300000, hasFreeOption: false, offerKinds: ["REEL"], contentFormats: ["Short-form video"], openToRequests: true, lastActiveDays: 2,
};
const ctx: MatchContext = { industry: "Real estate", categories: ["Personal finance"], topics: [], languages: ["en"], emirates: ["Dubai"], budgetMinFils: 100000, budgetMaxFils: 500000, contentFormats: ["Short-form video"], wantedKinds: [], minAudience: 10000 };

describe("matching", () => {
  it("scores a strong fit highly with explanations", () => {
    const r = scoreCandidate(ctx, base, W);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.reasons.join(" ")).toMatch(/audience in target area/);
    expect(r.concerns).toHaveLength(0);
    expect(r.confidence).toBe("high");
  });

  it("penalises budget mismatch and explains it", () => {
    const r = scoreCandidate(ctx, { ...base, priceFromFils: 2_000_000 }, W);
    expect(r.dimensions.budget).toBeLessThan(0.2);
    expect(r.concerns).toContain("Above stated budget");
  });

  it("treats missing data as neutral and surfaces it", () => {
    const sparse: Candidate = { ...base, audienceGeo: [], audienceInterests: [], priceFromFils: null, engagementRate: null, verified: false, reviewAvg: null, reviewCount: 0, completedDeals: 0, reach: null, emirate: null };
    const r = scoreCandidate(ctx, sparse, W);
    expect(r.missing).toEqual(expect.arrayContaining(["Audience geography", "Pricing", "Location", "Audience size"]));
    expect(r.confidence).not.toBe("high");
    expect(r.score).toBeGreaterThan(20);
  });

  it("flags implausible engagement without excluding the creator", () => {
    const r = scoreCandidate(ctx, { ...base, engagementRate: 40 }, W);
    expect(r.concerns.join(" ")).toMatch(/Unusually high engagement/);
    expect(r.score).toBeGreaterThan(0);
  });

  it("respects configurable weights", () => {
    const geoOnly = { audience: 0, industry: 0, geography: 100, quality: 0, budget: 0, content: 0, availability: 0 };
    expect(scoreCandidate(ctx, { ...base, emirate: "Fujairah" }, geoOnly).score).toBe(50);
    expect(scoreCandidate(ctx, base, geoOnly).score).toBe(100);
  });

  it("has no input for protected attributes (structural guarantee)", () => {
    const keys = Object.keys(base);
    for (const k of ["gender", "nationality", "religion", "age", "ethnicity"]) expect(keys).not.toContain(k);
  });

  it("ranks and excludes hidden candidates", () => {
    const list = rankCandidates(ctx, [base, { ...base, id: "c2", industry: "Gaming", niches: [] }, { ...base, id: "c3" }], W, new Set(["c3"]));
    expect(list.map((r) => r.candidateId)).toEqual(["c1", "c2"]);
  });
});
