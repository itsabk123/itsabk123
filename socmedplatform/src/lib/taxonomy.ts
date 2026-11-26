// Default taxonomy. Admins can extend these via TaxonomyTerm; these values are the seed set.

export const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"] as const;

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
  { code: "ml", label: "Malayalam" },
  { code: "tl", label: "Tagalog" },
  { code: "fr", label: "French" },
  { code: "ru", label: "Russian" },
  { code: "fa", label: "Persian" },
] as const;
export const languageLabel = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code;

export const INDUSTRIES = [
  "Real estate", "Finance & fintech", "Technology", "E-commerce & retail", "Hospitality & F&B",
  "Travel & tourism", "Health & wellness", "Beauty & fashion", "Education", "Automotive",
  "Media & entertainment", "Sports & fitness", "Business & entrepreneurship", "Marketing & advertising",
  "Parenting & family", "Food", "Gaming", "Sustainability", "Government & public sector", "Other",
] as const;

export const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN", "SNAPCHAT", "X", "FACEBOOK", "SPOTIFY", "APPLE_PODCASTS", "BLOG", "NEWSLETTER"] as const;
export const platformLabel: Record<string, string> = {
  INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE: "YouTube", LINKEDIN: "LinkedIn", SNAPCHAT: "Snapchat",
  X: "X", FACEBOOK: "Facebook", SPOTIFY: "Spotify", APPLE_PODCASTS: "Apple Podcasts", BLOG: "Blog", NEWSLETTER: "Newsletter",
};

export const OFFERING_KINDS: Record<string, { label: string; for: ("PODCAST" | "INFLUENCER" | "GUEST")[]; deal: string }> = {
  PRE_ROLL: { label: "Pre-roll ad", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  MID_ROLL: { label: "Mid-roll ad", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  POST_ROLL: { label: "Post-roll ad", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  HOST_READ: { label: "Host-read ad", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  SPONSORED_EPISODE: { label: "Sponsored episode", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  BRANDED_SEGMENT: { label: "Branded segment", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  PRODUCT_PLACEMENT: { label: "Product placement", for: ["PODCAST", "INFLUENCER"], deal: "PODCAST_SPONSORSHIP" },
  VIDEO_SPONSORSHIP: { label: "Video sponsorship", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  LOGO_PLACEMENT: { label: "Logo placement", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  SPONSORED_INTERVIEW: { label: "Sponsored interview", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  SPONSORED_SERIES: { label: "Sponsored series", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  AFFILIATE: { label: "Affiliate partnership", for: ["PODCAST", "INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  EVENT_SPONSORSHIP: { label: "Event sponsorship", for: ["PODCAST"], deal: "EVENT_APPEARANCE" },
  SOCIAL_CLIPS: { label: "Social media clips", for: ["PODCAST"], deal: "PODCAST_SPONSORSHIP" },
  NEWSLETTER: { label: "Newsletter sponsorship", for: ["PODCAST", "INFLUENCER"], deal: "PODCAST_SPONSORSHIP" },
  CROSS_PLATFORM: { label: "Cross-platform package", for: ["PODCAST", "INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  SPONSORED_POST: { label: "Sponsored post", for: ["INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  SPONSORED_STORY: { label: "Sponsored story", for: ["INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  REEL: { label: "Reel", for: ["INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  TIKTOK_VIDEO: { label: "TikTok video", for: ["INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  YOUTUBE_INTEGRATION: { label: "YouTube integration", for: ["INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  YOUTUBE_DEDICATED: { label: "Dedicated YouTube video", for: ["INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  LINKEDIN_POST: { label: "LinkedIn thought-leadership post", for: ["INFLUENCER", "GUEST"], deal: "INFLUENCER_CAMPAIGN" },
  PRODUCT_REVIEW: { label: "Product review", for: ["INFLUENCER"], deal: "INFLUENCER_CAMPAIGN" },
  EVENT_APPEARANCE: { label: "Event appearance", for: ["INFLUENCER", "GUEST"], deal: "EVENT_APPEARANCE" },
  AMBASSADOR: { label: "Brand ambassadorship", for: ["INFLUENCER"], deal: "AMBASSADOR" },
  UGC_VIDEO: { label: "UGC video production", for: ["INFLUENCER"], deal: "UGC_PRODUCTION" },
  GUEST_APPEARANCE: { label: "Podcast guest appearance", for: ["INFLUENCER", "GUEST"], deal: "GUEST_APPEARANCE" },
  SPEAKING: { label: "Panel / speaking", for: ["GUEST"], deal: "EVENT_APPEARANCE" },
};

export const GUEST_APPEARANCE_TYPES: Record<string, string> = {
  FREE_EXPERT: "Free expert appearance",
  PAID: "Paid appearance",
  SPONSORED: "Sponsored appearance",
  PROMOTIONAL: "Business promotional interview",
  THOUGHT_LEADERSHIP: "Thought-leadership interview",
  PANEL: "Expert panel",
};

export const CAMPAIGN_OBJECTIVES = [
  "Brand awareness", "Lead generation", "Sales / conversions", "Product launch", "App installs",
  "Event attendance", "Thought leadership", "Recruitment / employer brand", "Community growth",
] as const;

export const CONTENT_FORMATS = ["Audio ad", "Video ad", "Short-form video", "Long-form video", "Static post", "Story", "Live", "Interview", "Written review", "Newsletter", "Event"] as const;

export const SUCCESS_METRICS = ["Impressions", "Reach", "Views", "Engagement", "Link clicks", "Leads", "Conversions", "Coupon redemptions", "Downloads", "Sign-ups"] as const;

/** Categories with additional UAE advertising rules. Campaigns in these require human compliance review. */
export const REGULATED_CATEGORIES: Record<string, string> = {
  HEALTHCARE: "Healthcare, medical & pharmaceuticals",
  FINANCIAL: "Financial services, investment & crypto",
  REAL_ESTATE: "Real estate (off-plan, brokerage)",
  ALCOHOL: "Alcohol",
  TOBACCO: "Tobacco & vaping",
  GAMBLING: "Gambling / lotteries",
  EDUCATION: "Education & licensed training",
  SUPPLEMENTS: "Supplements & weight loss",
  CHILDREN: "Products aimed at children",
};
/** Categories the platform does not accept by default (admin-configurable). */
export const PROHIBITED_DEFAULT = ["TOBACCO", "GAMBLING"];

export const PROFILE_TYPE_META = {
  BRAND: { label: "Brand", plural: "Brands", path: "brands" },
  PODCAST: { label: "Podcast", plural: "Podcasts", path: "podcasts" },
  GUEST: { label: "Guest", plural: "Guests", path: "guests" },
  INFLUENCER: { label: "Influencer", plural: "Influencers", path: "influencers" },
  AGENCY: { label: "Agency", plural: "Agencies", path: "agencies" },
} as const;
export type ProfileTypeKey = keyof typeof PROFILE_TYPE_META;

export const METRIC_SOURCE_LABEL: Record<string, string> = {
  API_VERIFIED: "Verified via platform API",
  CREATOR_REPORTED: "Self-reported by creator",
  ADVERTISER_REPORTED: "Reported by advertiser",
  PLATFORM_ESTIMATED: "Platform estimate",
};
