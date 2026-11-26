import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url;
  const statics = ["", "/how-it-works", "/for/brands", "/for/podcast-hosts", "/for/guests", "/for/influencers", "/for/agencies", "/discover/podcasts", "/discover/influencers", "/discover/guests", "/discover/brands", "/discover/sponsorships", "/campaigns", "/pricing", "/success-stories", "/resources", "/blog", "/about", "/contact", "/faq", "/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/guidelines", "/legal/disputes"];
  const [profiles, campaigns, posts] = await Promise.all([
    // Only published, public, indexable, non-demo profiles with real substance — no thin pages.
    db.profile.findMany({ where: { status: "PUBLISHED", visibility: "PUBLIC", indexable: true, isDemo: false, completeness: { gte: 50 } }, select: { slug: true, updatedAt: true }, take: 5000 }),
    db.campaign.findMany({ where: { status: "OPEN", visibility: "PUBLIC", isDemo: false }, select: { slug: true, updatedAt: true }, take: 2000 }),
    db.post.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...statics.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const })),
    ...profiles.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt })),
    ...campaigns.map((c) => ({ url: `${base}/campaigns/${c.slug}`, lastModified: c.updatedAt })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
