/**
 * Seeds reference data (plans, taxonomy, config) and an initial super-admin.
 * With SEED_DEMO=1 it also creates clearly-labelled DEMO profiles and campaigns (isDemo = true) so the
 * marketplace can be explored locally. Demo data is badged in the UI, excluded from the sitemap, and must
 * never be loaded into production. Figures in demo data are illustrative only.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const db = new PrismaClient();
const rid = () => randomBytes(4).toString("hex");

async function base() {
  const plans = [
    { code: "FREE", audience: "ALL", name: "Free", tagline: "Everything you need to start", priceMonthlyFils: 0, sort: 0,
      features: ["Unlimited profiles on one account", "Discovery & explainable match scores", "1 active campaign", "10 invitations or applications per month", "Messaging, contracts & payments", "Fee only on paid deals"] },
    { code: "CREATOR_PRO", audience: "CREATOR", name: "Creator Pro", tagline: "For podcasts, creators and guests who sell", priceMonthlyFils: 0, sort: 1,
      features: ["Unlimited applications & pitches", "Enhanced profile & media kit", "Performance analytics", "Priority support"] },
    { code: "BRAND_PRO", audience: "BRAND", name: "Brand Pro", tagline: "For in-house marketing teams", priceMonthlyFils: 0, sort: 2,
      features: ["Unlimited campaigns & invitations", "Advanced filters & AI matching", "Team seats", "Campaign analytics & CRM"] },
    { code: "AGENCY", audience: "AGENCY", name: "Agency", tagline: "Multiple brands and talent rosters", priceMonthlyFils: 0, sort: 3,
      features: ["Multiple client brands", "Represented talent", "Bulk invitations", "Consolidated & white-label reports"] },
  ];
  for (const p of plans) await db.plan.upsert({ where: { code: p.code }, create: { ...p, limits: {} }, update: {} });

  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "change-me-admin-123");
  if (!password) throw new Error("Set ADMIN_PASSWORD to seed the super-admin in production");
  await db.user.upsert({
    where: { email },
    create: { email, name: "Platform Admin", passwordHash: await bcrypt.hash(password, 12), platformRole: "SUPERADMIN", emailVerifiedAt: new Date(), referralCode: `adm${rid()}` },
    update: { platformRole: "SUPERADMIN" },
  });
  console.log(`Super-admin: ${email}`);
}

type DemoProfile = {
  email: string; name: string; type: "BRAND" | "PODCAST" | "GUEST" | "INFLUENCER" | "AGENCY"; displayName: string; headline: string; bio: string;
  emirate: string; city?: string; languages: string[]; industry: string; niches: string[];
  extra?: Record<string, unknown>; socials?: { platform: string; handle: string; followers: number; avgViews?: number; engagementRate?: number }[];
  metrics?: { key: string; value: number }[]; geo?: [string, number][]; interests?: [string, number][];
  offerings?: { kind: string; title: string; priceAed: number | null; priceType?: "FIXED" | "FROM" | "FREE" | "ON_REQUEST"; inventory?: number; bookable?: boolean }[];
  availability?: [number, string, string][];
};

const DEMO: DemoProfile[] = [
  { email: "demo.hostfin@demo.test", name: "Demo Host One", type: "PODCAST", displayName: "The Gulf Money Show (Demo)", headline: "Weekly conversations on personal finance for UAE residents",
    bio: "A demonstration podcast profile. Episodes cover saving, investing basics and property decisions for people living and working in the UAE. Guests include planners, founders and economists.",
    emirate: "Dubai", city: "Business Bay", languages: ["en"], industry: "Finance & fintech", niches: ["Personal finance", "Real estate"],
    extra: { podcast: { format: "BOTH", frequency: "Weekly", avgDurationMin: 45, episodeCount: 120, guestBookingOpen: true, spotifyUrl: "https://open.spotify.com/" } },
    socials: [{ platform: "YOUTUBE", handle: "gulfmoneydemo", followers: 18000, avgViews: 4200, engagementRate: 3.1 }], metrics: [{ key: "monthly_downloads", value: 26000 }],
    geo: [["Dubai", 48], ["Abu Dhabi", 22], ["Sharjah", 9], ["Saudi Arabia", 8]], interests: [["Personal finance", 60], ["Real estate", 35]],
    offerings: [{ kind: "MID_ROLL", title: "60-second host-read mid-roll", priceAed: 2500, inventory: 8 }, { kind: "SPONSORED_EPISODE", title: "Sponsored episode with your expert", priceAed: 9000, inventory: 2 }],
    availability: [[1, "10:00", "14:00"], [3, "10:00", "14:00"]] },
  { email: "demo.hostar@demo.test", name: "Demo Host Two", type: "PODCAST", displayName: "Majlis Al Riyada (Demo)", headline: "Arabic interviews with founders building across the GCC",
    bio: "A demonstration Arabic-language business podcast profile featuring long-form interviews with entrepreneurs from Abu Dhabi, Dubai and the wider region.",
    emirate: "Abu Dhabi", languages: ["ar", "en"], industry: "Business & entrepreneurship", niches: ["Startups", "Technology"],
    extra: { podcast: { format: "VIDEO", frequency: "Fortnightly", avgDurationMin: 60, episodeCount: 48, guestBookingOpen: true } },
    socials: [{ platform: "YOUTUBE", handle: "riyadademo", followers: 42000, avgViews: 9000, engagementRate: 2.4 }], metrics: [{ key: "monthly_video_views", value: 110000 }],
    geo: [["Abu Dhabi", 30], ["Dubai", 28], ["Saudi Arabia", 25]], interests: [["Startups", 55], ["Technology", 40]],
    offerings: [{ kind: "PRE_ROLL", title: "Pre-roll video sponsorship", priceAed: 4000 }, { kind: "SPONSORED_INTERVIEW", title: "Sponsored founder interview", priceAed: 12000, inventory: 1 }] },
  { email: "demo.hostfood@demo.test", name: "Demo Host Three", type: "PODCAST", displayName: "Sharjah Kitchen Stories (Demo)", headline: "Food, family recipes and the people behind UAE restaurants",
    bio: "A demonstration food & hospitality podcast with chefs and restaurant owners across the northern emirates.",
    emirate: "Sharjah", languages: ["en", "hi"], industry: "Food", niches: ["Restaurants", "Hospitality & F&B"],
    extra: { podcast: { format: "AUDIO", frequency: "Weekly", avgDurationMin: 30, episodeCount: 65, guestBookingOpen: false } },
    socials: [{ platform: "INSTAGRAM", handle: "sharjahkitchendemo", followers: 9500, avgViews: 3000, engagementRate: 5.2 }], metrics: [{ key: "monthly_downloads", value: 7000 }],
    geo: [["Sharjah", 40], ["Dubai", 30], ["Ajman", 12]], offerings: [{ kind: "HOST_READ", title: "Host-read ad (3 episodes)", priceAed: 1800 }] },
  { email: "demo.inf1@demo.test", name: "Demo Creator One", type: "INFLUENCER", displayName: "Layla Creates (Demo)", headline: "Lifestyle & wellness creator — reels and honest reviews",
    bio: "A demonstration creator profile. Short-form video on wellness, home and family life in Dubai, in English and Arabic.",
    emirate: "Dubai", languages: ["en", "ar"], industry: "Health & wellness", niches: ["Wellness", "Parenting & family"],
    extra: { influencer: { contentFormats: ["Short-form video", "Story", "Written review"], preferredCategories: ["Health & wellness", "Food"], advertiserPermitNo: "DEMO-0000", permitExpiresAt: new Date(Date.now() + 200 * 86400_000) } },
    socials: [{ platform: "INSTAGRAM", handle: "laylacreatesdemo", followers: 64000, avgViews: 21000, engagementRate: 3.8 }, { platform: "TIKTOK", handle: "laylademo", followers: 31000, avgViews: 15000, engagementRate: 6.1 }],
    geo: [["Dubai", 52], ["Abu Dhabi", 18], ["Sharjah", 10]], interests: [["Wellness", 50], ["Food", 30]],
    offerings: [{ kind: "REEL", title: "1 Instagram reel + 3 stories", priceAed: 3500 }, { kind: "UGC_VIDEO", title: "UGC video (brand-owned, 30s)", priceAed: 1500 }] },
  { email: "demo.inf2@demo.test", name: "Demo Creator Two", type: "INFLUENCER", displayName: "Omar Drives (Demo)", headline: "Car reviews and road trips across the seven emirates",
    bio: "A demonstration automotive creator. Long-form YouTube reviews and TikTok shorts, mostly in Arabic.",
    emirate: "Ras Al Khaimah", languages: ["ar"], industry: "Automotive", niches: ["Cars", "Travel & tourism"],
    extra: { influencer: { contentFormats: ["Long-form video", "Short-form video"], preferredCategories: ["Automotive", "Travel & tourism"] } },
    socials: [{ platform: "YOUTUBE", handle: "omardrivesdemo", followers: 120000, avgViews: 38000, engagementRate: 4.2 }], geo: [["Saudi Arabia", 35], ["Dubai", 20], ["Ras Al Khaimah", 10]],
    offerings: [{ kind: "YOUTUBE_INTEGRATION", title: "60–90s YouTube integration", priceAed: 7500 }, { kind: "EVENT_APPEARANCE", title: "Launch event appearance", priceAed: null, priceType: "ON_REQUEST" }] },
  { email: "demo.inf3@demo.test", name: "Demo Creator Three", type: "INFLUENCER", displayName: "Priya on LinkedIn (Demo)", headline: "B2B marketing insights for GCC founders",
    bio: "A demonstration LinkedIn creator writing about B2B marketing, hiring and growth in the UAE.",
    emirate: "Dubai", languages: ["en", "hi"], industry: "Marketing & advertising", niches: ["B2B", "Startups"],
    extra: { influencer: { contentFormats: ["Static post", "Live"], preferredCategories: ["Technology", "Business & entrepreneurship"] } },
    socials: [{ platform: "LINKEDIN", handle: "priyademo", followers: 22000, avgViews: 6000, engagementRate: 2.9 }], geo: [["Dubai", 45], ["India", 25]],
    offerings: [{ kind: "LINKEDIN_POST", title: "Thought-leadership post", priceAed: 2000 }, { kind: "GUEST_APPEARANCE", title: "Podcast guest appearance", priceAed: null, priceType: "FREE" }] },
  { email: "demo.guest1@demo.test", name: "Demo Guest One", type: "GUEST", displayName: "Dr. Sara (Demo)", headline: "Sleep & performance specialist available for interviews",
    bio: "A demonstration guest profile for a clinician who speaks about sleep, stress and performance for professionals.",
    emirate: "Abu Dhabi", languages: ["en", "ar"], industry: "Health & wellness", niches: ["Wellness"],
    extra: { guest: { professionalTitle: "Sleep specialist", company: "Demo Clinic", seniority: "Specialist", expertise: ["Sleep", "Performance"], topics: ["Sleep science", "Burnout", "Shift work"], excludedTopics: ["Medication advice"], appearanceTypes: ["FREE_EXPERT", "PANEL"], virtualAvailable: true, willingToTravel: true } },
    offerings: [{ kind: "GUEST_APPEARANCE", title: "Expert interview (remote or studio)", priceAed: null, priceType: "FREE", bookable: true }], availability: [[0, "16:00", "19:00"], [2, "16:00", "19:00"]] },
  { email: "demo.guest2@demo.test", name: "Demo Guest Two", type: "GUEST", displayName: "Khalid, Fintech Founder (Demo)", headline: "Founder on payments, regulation and scaling in the GCC",
    bio: "A demonstration founder profile. Happy to discuss building a regulated fintech, fundraising and hiring in the UAE.",
    emirate: "Dubai", languages: ["ar", "en"], industry: "Finance & fintech", niches: ["Startups", "Personal finance"],
    extra: { guest: { professionalTitle: "Co-founder & CEO", company: "Demo Pay", seniority: "Founder", expertise: ["Fintech", "Fundraising"], topics: ["Payments", "Regulation", "Fundraising"], appearanceTypes: ["FREE_EXPERT", "THOUGHT_LEADERSHIP", "SPONSORED"], virtualAvailable: true } } },
  { email: "demo.guest3@demo.test", name: "Demo Guest Three", type: "GUEST", displayName: "Maria, Hospitality GM (Demo)", headline: "Hotel GM talking guest experience and careers in hospitality",
    bio: "A demonstration guest profile for a hospitality leader.", emirate: "Ras Al Khaimah", languages: ["en", "tl"], industry: "Hospitality & F&B", niches: ["Hospitality & F&B", "Travel & tourism"],
    extra: { guest: { professionalTitle: "General Manager", company: "Demo Resort", seniority: "Director", expertise: ["Hospitality"], topics: ["Guest experience", "Careers"], appearanceTypes: ["FREE_EXPERT"], virtualAvailable: true } } },
  { email: "demo.brand1@demo.test", name: "Demo Brand One", type: "BRAND", displayName: "Palm Homes Realty (Demo)", headline: "Off-plan and ready homes in Dubai",
    bio: "A demonstration real-estate brand looking for finance and lifestyle podcasts and creators.", emirate: "Dubai", languages: ["en", "ar"], industry: "Real estate", niches: ["Real estate", "Personal finance"],
    extra: { brand: { companySize: "51-200", audienceType: "B2C", targetGeographies: ["Dubai", "Abu Dhabi"], budgetMinFils: 200000, budgetMaxFils: 1500000, objectives: ["Lead generation"] } } },
  { email: "demo.brand2@demo.test", name: "Demo Brand Two", type: "BRAND", displayName: "Oasis Wellness Cafe (Demo)", headline: "Healthy cafes in Sharjah and Dubai",
    bio: "A demonstration F&B brand.", emirate: "Sharjah", languages: ["en"], industry: "Food", niches: ["Wellness", "Restaurants"],
    extra: { brand: { companySize: "11-50", audienceType: "B2C", targetGeographies: ["Sharjah", "Dubai"], budgetMinFils: 50000, budgetMaxFils: 400000, objectives: ["Brand awareness"] } } },
  { email: "demo.brand3@demo.test", name: "Demo Brand Three", type: "BRAND", displayName: "Dhow Cloud (Demo)", headline: "B2B software for SMEs",
    bio: "A demonstration B2B software brand.", emirate: "Abu Dhabi", languages: ["en", "ar"], industry: "Technology", niches: ["B2B", "Startups"],
    extra: { brand: { companySize: "201-1000", audienceType: "B2B", targetGeographies: [], budgetMinFils: 300000, budgetMaxFils: 2000000, objectives: ["Thought leadership", "Lead generation"] } } },
  { email: "demo.agency@demo.test", name: "Demo Agency", type: "AGENCY", displayName: "Creek Talent Co. (Demo)", headline: "Talent management for UAE creators",
    bio: "A demonstration talent agency.", emirate: "Dubai", languages: ["en", "ar"], industry: "Marketing & advertising", niches: ["Talent"], extra: { agency: { agencyType: "TALENT", services: ["Talent management", "Campaign management"] } } },
];

async function demo() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  const pw = await bcrypt.hash("demo-password-123", 10);
  const byEmail: Record<string, string> = {};
  for (const d of DEMO) {
    const user = await db.user.upsert({ where: { email: d.email }, create: { email: d.email, name: d.name, passwordHash: pw, emailVerifiedAt: new Date(), referralCode: `demo${rid()}` }, update: {} });
    const existing = await db.profile.findFirst({ where: { ownerUserId: user.id } });
    if (existing) { byEmail[d.email] = existing.id; continue; }
    let organizationId: string | undefined;
    if (d.type === "BRAND" || d.type === "AGENCY") {
      const org = await db.organization.create({ data: { name: d.displayName, slug: `${d.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${rid()}`, type: d.type === "AGENCY" ? "AGENCY" : "BRAND", members: { create: { userId: user.id, role: "OWNER" } } } });
      organizationId = org.id;
    }
    const x = (d.extra ?? {}) as Record<string, Record<string, unknown>>;
    const p = await db.profile.create({
      data: {
        type: d.type, slug: d.displayName.toLowerCase().replace(/\(demo\)/, "").replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") + "-demo",
        displayName: d.displayName, headline: d.headline, bio: d.bio, emirate: d.emirate, city: d.city, languages: d.languages, industry: d.industry, niches: d.niches,
        status: "PUBLISHED", isDemo: true, indexable: false, ownerUserId: user.id, organizationId, completeness: 80, lastActiveAt: new Date(),
        ...(d.type === "PODCAST" ? { podcast: { create: x.podcast ?? {} } } : {}),
        ...(d.type === "GUEST" ? { guest: { create: x.guest ?? {} } } : {}),
        ...(d.type === "INFLUENCER" ? { influencer: { create: x.influencer ?? {} } } : {}),
        ...(d.type === "BRAND" ? { brand: { create: x.brand ?? {} } } : {}),
        ...(d.type === "AGENCY" ? { agency: { create: x.agency ?? {} } } : {}),
        socialAccounts: { create: (d.socials ?? []).map((s) => ({ ...s, source: "CREATOR_REPORTED" as const })) },
        metrics: { create: (d.metrics ?? []).map((m) => ({ ...m, source: "CREATOR_REPORTED" as const, periodLabel: "Demo" })) },
        audience: { create: [...(d.geo ?? []).map(([bucket, share]) => ({ dimension: "GEO", bucket, share })), ...(d.interests ?? []).map(([bucket, share]) => ({ dimension: "INTEREST", bucket, share }))] },
        offerings: { create: (d.offerings ?? []).map((o) => ({ kind: o.kind, title: o.title, priceType: o.priceType ?? "FIXED", priceFils: o.priceAed !== null ? o.priceAed * 100 : null, inventoryTotal: o.inventory ?? null, bookable: !!o.bookable, durationMin: o.bookable ? 60 : null })) },
        availability: { create: (d.availability ?? []).map(([weekday, s, e]) => ({ weekday, startMinute: +s.split(":")[0] * 60 + +s.split(":")[1], endMinute: +e.split(":")[0] * 60 + +e.split(":")[1] })) },
      },
    });
    const priced = (d.offerings ?? []).filter((o) => o.priceAed).map((o) => o.priceAed! * 100);
    if (priced.length) await db.profile.update({ where: { id: p.id }, data: { priceFromFils: Math.min(...priced) } });
    byEmail[d.email] = p.id;
  }
  const brand = (e: string) => byEmail[e];
  const camps = [
    { brand: "demo.brand1@demo.test", name: "Spring home-buyer series (Demo)", objective: "Lead generation", industry: "Real estate", categories: ["Personal finance", "Real estate"], targetEmirates: ["Dubai"], languages: ["en", "ar"], creatorTypes: ["PODCAST", "INFLUENCER"], contentFormats: ["Audio ad", "Short-form video"], budgetMinFils: 200000, budgetMaxFils: 1000000, regulatedCategory: "REAL_ESTATE", complianceStatus: "APPROVED" as const },
    { brand: "demo.brand2@demo.test", name: "New menu launch (Demo)", objective: "Brand awareness", industry: "Food", categories: ["Wellness", "Food"], targetEmirates: ["Sharjah", "Dubai"], languages: ["en"], creatorTypes: ["INFLUENCER"], contentFormats: ["Short-form video", "Story"], budgetMinFils: 50000, budgetMaxFils: 350000 },
    { brand: "demo.brand3@demo.test", name: "SME founders thought-leadership (Demo)", objective: "Thought leadership", industry: "Technology", categories: ["Startups", "B2B"], targetEmirates: [], languages: ["en", "ar"], creatorTypes: ["PODCAST", "GUEST"], contentFormats: ["Interview"], budgetMinFils: 300000, budgetMaxFils: 1500000 },
  ];
  for (const c of camps) {
    const bid = brand(c.brand);
    if (await db.campaign.findFirst({ where: { brandProfileId: bid, name: c.name } })) continue;
    const owner = await db.profile.findUniqueOrThrow({ where: { id: bid } });
    const { brand: _b, ...rest } = c;
    void _b;
    await db.campaign.create({ data: { ...rest, slug: `${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${rid()}`, brandProfileId: bid, createdByUserId: owner.ownerUserId, status: "OPEN", isDemo: true, instructions: "Demonstration brief. Share an honest perspective, show the product in real use, and clearly label the content as advertising.", deliverables: { create: [{ kind: "Reel or mid-roll", quantity: 1 }] } } });
  }
  console.log(`Demo data: ${DEMO.length} profiles (password: demo-password-123), ${camps.length} campaigns`);
}

base()
  .then(() => (process.env.SEED_DEMO === "1" ? demo() : undefined))
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
