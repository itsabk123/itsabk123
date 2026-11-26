import { db } from "./db";

/** Every commercial number is configurable by admins. These are starting defaults, not market benchmarks. */
export const DEFAULT_CONFIG = {
  commission: {
    // Percent of deal value charged to the payee (deducted from payout). Placeholder values — tune after UAE pricing research.
    PODCAST_SPONSORSHIP: 12,
    INFLUENCER_CAMPAIGN: 12,
    GUEST_APPEARANCE: 10,
    UGC_PRODUCTION: 12,
    EVENT_APPEARANCE: 12,
    AMBASSADOR: 10,
    OTHER: 12,
    agencyDiscountPct: 2, // reduction in commission points for agency-managed deals
    minimumDealFils: 10000, // AED 100 minimum for paid deals
  },
  vat: { ratePct: 5, applyToPlatformFee: true, trn: "" },
  matchWeights: { audience: 25, industry: 20, geography: 15, quality: 15, budget: 10, content: 10, availability: 5 },
  featured: { dayPriceFils: 0, enabled: false },
  freeTier: { activeCampaigns: 1, monthlyInvites: 10, monthlyApplications: 10 },
  reviews: { revealAfterDays: 14 },
  payouts: { autoEligibleAfterDays: 3 },
  prohibitedCategories: ["TOBACCO", "GAMBLING"],
  features: { aiAssist: true, featuredListings: false, whatsapp: false, subscriptionsCheckout: false },
};
export type PlatformConfigShape = typeof DEFAULT_CONFIG;
export type ConfigKey = keyof PlatformConfigShape;

export async function getConfig<K extends ConfigKey>(key: K): Promise<PlatformConfigShape[K]> {
  const row = await db.platformConfig.findUnique({ where: { key } });
  if (!row) return DEFAULT_CONFIG[key];
  const def = DEFAULT_CONFIG[key];
  if (Array.isArray(def)) return row.value as PlatformConfigShape[K];
  return { ...(def as object), ...(row.value as object) } as PlatformConfigShape[K];
}

export async function setConfig<K extends ConfigKey>(key: K, value: PlatformConfigShape[K], userId: string) {
  await db.platformConfig.upsert({
    where: { key },
    create: { key, value: value as object, updatedBy: userId },
    update: { value: value as object, updatedBy: userId },
  });
}
