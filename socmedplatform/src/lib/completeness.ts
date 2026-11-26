import type { Prisma } from "@prisma/client";

type P = Prisma.ProfileGetPayload<{ include: { podcast: true; guest: true; influencer: true; brand: true; socialAccounts: true; offerings: true; audience: true } }>;

export type CompletenessItem = { key: string; label: string; done: boolean; href: string };

/** Progressive onboarding: items that most improve match quality, per profile type. */
export function completenessItems(p: P): CompletenessItem[] {
  const e = `/app/profiles/${p.id}/edit`;
  const items: CompletenessItem[] = [
    { key: "headline", label: "Add a one-line headline", done: !!p.headline, href: e },
    { key: "bio", label: "Write a bio (80+ characters)", done: (p.bio?.length ?? 0) >= 80, href: e },
    { key: "avatar", label: "Add a profile image", done: !!p.avatarUrl, href: e },
    { key: "location", label: "Set your emirate", done: !!p.emirate, href: e },
    { key: "languages", label: "Choose languages", done: p.languages.length > 0, href: e },
    { key: "industry", label: "Choose an industry and niches", done: !!p.industry && p.niches.length > 0, href: e },
  ];
  if (p.type === "PODCAST") {
    items.push(
      { key: "links", label: "Link Spotify, Apple or YouTube", done: !!(p.podcast?.spotifyUrl || p.podcast?.appleUrl || p.podcast?.youtubeUrl), href: e },
      { key: "metrics", label: "Add audience size", done: p.socialAccounts.length > 0, href: `${e}#audience` },
      { key: "offerings", label: "Publish a sponsorship package", done: p.offerings.length > 0, href: `${e}#offerings` },
    );
  }
  if (p.type === "INFLUENCER") {
    items.push(
      { key: "social", label: "Add social accounts", done: p.socialAccounts.length > 0, href: `${e}#audience` },
      { key: "audience", label: "Add audience geography", done: p.audience.some((a) => a.dimension === "GEO"), href: `${e}#audience` },
      { key: "offerings", label: "List your rates", done: p.offerings.length > 0, href: `${e}#offerings` },
      { key: "permit", label: "Add advertiser permit details (if applicable)", done: !!p.influencer?.advertiserPermitNo, href: e },
    );
  }
  if (p.type === "GUEST") {
    items.push(
      { key: "topics", label: "List topics you can speak on", done: (p.guest?.topics.length ?? 0) > 0, href: e },
      { key: "title", label: "Add your professional title", done: !!p.guest?.professionalTitle, href: e },
      { key: "appearance", label: "Choose appearance types", done: (p.guest?.appearanceTypes.length ?? 0) > 0, href: e },
    );
  }
  if (p.type === "BRAND") {
    items.push(
      { key: "website", label: "Add your website", done: !!p.website, href: e },
      { key: "budget", label: "Set a typical budget range", done: !!p.brand?.budgetMaxFils, href: e },
      { key: "targets", label: "Choose target emirates", done: (p.brand?.targetGeographies.length ?? 0) > 0, href: e },
    );
  }
  return items;
}

export function completenessScore(p: P) {
  const items = completenessItems(p);
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}
