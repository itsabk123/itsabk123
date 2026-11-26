"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { MetricSource, PriceType, ProfileType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor } from "@/lib/access";
import { bool, date, float, int, list, optStr, str, url } from "@/lib/forms";
import { parseAedToFils } from "@/lib/money";
import { uniqueSlug, slugify } from "@/lib/slug";
import { completenessScore } from "@/lib/completeness";
import { bioFingerprint, engagementSignals } from "@/lib/fraud";
import { audit, track } from "@/lib/audit";
import { putFile } from "@/lib/storage";
import { hhmmToMinutes } from "@/lib/time";
import { OFFERING_KINDS, PLATFORMS } from "@/lib/taxonomy";

const TYPES: ProfileType[] = ["BRAND", "PODCAST", "GUEST", "INFLUENCER", "AGENCY"];

async function guard(profileId: string) {
  const user = await requireUser();
  if (!(await canActFor(user.id, profileId))) redirect("/app?err=Not+authorised");
  return user;
}
const editPath = (id: string, msg?: string, anchor = "") => `/app/profiles/${id}/edit${msg ? `?ok=${encodeURIComponent(msg)}` : ""}${anchor}`;

export async function createProfile(fd: FormData) {
  const user = await requireUser();
  const type = str(fd, "type") as ProfileType;
  if (!TYPES.includes(type)) redirect("/app/onboarding?err=Choose+a+profile+type");
  const displayName = str(fd, "displayName", 120) || user.name;
  const count = await db.profile.count({ where: { ownerUserId: user.id } });
  if (count >= 12) redirect("/app/profiles?err=Profile+limit+reached");
  let organizationId: string | null = null;
  if (type === "BRAND" || type === "AGENCY") {
    const existingOrgId = str(fd, "organizationId");
    if (existingOrgId) {
      const m = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: existingOrgId, userId: user.id } } });
      if (!m || !["OWNER", "ADMIN"].includes(m.role)) redirect("/app/onboarding?err=Not+authorised+for+that+organization");
      organizationId = existingOrgId;
    } else {
      const org = await db.organization.create({
        data: { name: displayName, slug: uniqueSlug(displayName), type: type === "AGENCY" ? "AGENCY" : "BRAND", members: { create: { userId: user.id, role: "OWNER" } } },
      });
      organizationId = org.id;
    }
  }
  const p = await db.profile.create({
    data: {
      type,
      displayName,
      slug: uniqueSlug(displayName),
      ownerUserId: user.id,
      organizationId,
      emirate: optStr(fd, "emirate", 40),
      languages: list(fd, "languages"),
      industry: optStr(fd, "industry", 80),
      headline: optStr(fd, "headline", 160),
      ...(type === "BRAND" ? { brand: { create: {} } } : {}),
      ...(type === "PODCAST" ? { podcast: { create: {} } } : {}),
      ...(type === "GUEST" ? { guest: { create: { appearanceTypes: ["FREE_EXPERT"] } } } : {}),
      ...(type === "INFLUENCER" ? { influencer: { create: {} } } : {}),
      ...(type === "AGENCY" ? { agency: { create: {} } } : {}),
    },
  });
  (await cookies()).set("mj_profile", p.id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  await track("profile_created", user.id, { type });
  redirect(editPath(p.id, "Profile created. Add a few details, then publish."));
}

async function recompute(profileId: string) {
  const p = await db.profile.findUniqueOrThrow({ where: { id: profileId }, include: { podcast: true, guest: true, influencer: true, brand: true, socialAccounts: true, offerings: { where: { isActive: true } }, audience: true } });
  const priced = p.offerings.filter((o) => o.priceFils !== null && o.priceType !== "FREE").map((o) => o.priceFils as number);
  await db.profile.update({ where: { id: profileId }, data: { completeness: completenessScore(p), priceFromFils: priced.length ? Math.min(...priced) : null } });
  // Quality signals → flags for human review only.
  for (const s of engagementSignals(p.socialAccounts)) {
    await db.fraudFlag.upsert({ where: { profileId_kind: { profileId, kind: s.kind } }, create: { profileId, ...s }, update: { details: s.details, score: s.score } });
  }
  const fp = bioFingerprint(p.bio);
  if (fp) {
    const dupes = await db.profile.findMany({ where: { id: { not: profileId }, bio: { startsWith: p.bio!.slice(0, 60) } }, select: { id: true, ownerUserId: true } });
    const others = dupes.filter((d) => d.ownerUserId !== p.ownerUserId);
    if (others.length)
      await db.fraudFlag.upsert({ where: { profileId_kind: { profileId, kind: "DUPLICATE_BIO" } }, create: { profileId, kind: "DUPLICATE_BIO", details: `Bio matches ${others.length} other account(s)`, score: 0.5 }, update: {} });
  }
}

export async function updateProfile(fd: FormData) {
  const id = str(fd, "id");
  const user = await guard(id);
  const p = await db.profile.findUniqueOrThrow({ where: { id } });
  const links: Record<string, string> = {};
  for (const k of ["instagram", "tiktok", "youtube", "linkedin", "x", "facebook", "snapchat"]) {
    const v = url(fd, `link_${k}`);
    if (v) links[k] = v;
  }
  const newSlug = slugify(str(fd, "slug", 60));
  if (newSlug && newSlug !== p.slug && (await db.profile.findUnique({ where: { slug: newSlug } }))) redirect(`/app/profiles/${id}/edit?err=That+profile+URL+is+taken`);
  await db.profile.update({
    where: { id },
    data: {
      displayName: str(fd, "displayName", 120) || p.displayName,
      slug: newSlug || p.slug,
      headline: optStr(fd, "headline", 160),
      bio: optStr(fd, "bio", 3000),
      avatarUrl: url(fd, "avatarUrl"),
      coverUrl: url(fd, "coverUrl"),
      emirate: optStr(fd, "emirate", 40),
      city: optStr(fd, "city", 80),
      serviceAreas: list(fd, "serviceAreas"),
      languages: list(fd, "languages"),
      industry: optStr(fd, "industry", 80),
      subIndustries: list(fd, "subIndustries"),
      niches: list(fd, "niches"),
      website: url(fd, "website"),
      links,
      contactEmail: optStr(fd, "contactEmail", 200),
      showContact: bool(fd, "showContact"),
      visibility: (["PUBLIC", "MEMBERS", "PRIVATE"].includes(str(fd, "visibility")) ? str(fd, "visibility") : "PUBLIC") as "PUBLIC",
      indexable: bool(fd, "indexable"),
    },
  });
  if (p.type === "BRAND")
    await db.brandDetails.update({
      where: { profileId: id },
      data: {
        companySize: optStr(fd, "companySize", 40), audienceType: optStr(fd, "audienceType", 10), targetGeographies: list(fd, "targetGeographies"),
        targetAudience: optStr(fd, "targetAudience", 500), budgetMinFils: parseAedToFils(fd.get("budgetMin")), budgetMaxFils: parseAedToFils(fd.get("budgetMax")),
        objectives: list(fd, "objectives"), preferredPlatforms: list(fd, "preferredPlatforms"), productCategories: list(fd, "productCategories"),
      },
    });
  if (p.type === "PODCAST")
    await db.podcastDetails.update({
      where: { profileId: id },
      data: {
        hostNames: optStr(fd, "hostNames", 200), productionCompany: optStr(fd, "productionCompany", 120), format: ["AUDIO", "VIDEO", "BOTH"].includes(str(fd, "format")) ? str(fd, "format") : "AUDIO",
        frequency: optStr(fd, "frequency", 40), avgDurationMin: int(fd, "avgDurationMin"), episodeCount: int(fd, "episodeCount"), recordingLocation: optStr(fd, "recordingLocation", 120),
        spotifyUrl: url(fd, "spotifyUrl"), appleUrl: url(fd, "appleUrl"), youtubeUrl: url(fd, "youtubeUrl"), guestBookingOpen: bool(fd, "guestBookingOpen"),
        guestRequirements: optStr(fd, "guestRequirements", 1000), recordingRequirements: optStr(fd, "recordingRequirements", 1000),
      },
    });
  if (p.type === "GUEST")
    await db.guestDetails.update({
      where: { profileId: id },
      data: {
        professionalTitle: optStr(fd, "professionalTitle", 120), company: optStr(fd, "company", 120), seniority: optStr(fd, "seniority", 40),
        expertise: list(fd, "expertise"), topics: list(fd, "topics"), excludedTopics: list(fd, "excludedTopics"), preferredCategories: list(fd, "preferredCategories"),
        appearanceTypes: list(fd, "appearanceTypes"), willingToTravel: bool(fd, "willingToTravel"), virtualAvailable: bool(fd, "virtualAvailable"),
        introVideoUrl: url(fd, "introVideoUrl"), linkedinUrl: url(fd, "linkedinUrl"), mediaKitUrl: url(fd, "mediaKitUrl"), objectives: list(fd, "objectives"),
      },
    });
  if (p.type === "INFLUENCER")
    await db.influencerDetails.update({
      where: { profileId: id },
      data: {
        creatorName: optStr(fd, "creatorName", 120), contentFormats: list(fd, "contentFormats"), preferredCategories: list(fd, "preferredCategories"),
        brandExclusions: list(fd, "brandExclusions"), nationality: optStr(fd, "nationality", 60), advertiserPermitNo: optStr(fd, "advertiserPermitNo", 60),
        permitExpiresAt: date(fd, "permitExpiresAt"), mediaKitUrl: url(fd, "mediaKitUrl"),
      },
    });
  if (p.type === "AGENCY")
    await db.agencyDetails.update({ where: { profileId: id }, data: { agencyType: optStr(fd, "agencyType", 40), services: list(fd, "services") } });
  await recompute(id);
  await audit(user.id, "profile.update", { type: "Profile", id });
  revalidatePath(`/p/${p.slug}`);
  redirect(editPath(id, "Saved"));
}

export async function setPublished(fd: FormData) {
  const id = str(fd, "id");
  const user = await guard(id);
  const publish = str(fd, "publish") === "1";
  const p = await db.profile.findUniqueOrThrow({ where: { id } });
  if (p.status === "SUSPENDED") redirect(editPath(id));
  if (publish) {
    const missing = [!p.headline && !p.bio && "a headline or bio", !p.emirate && "your emirate", !p.languages.length && "languages"].filter(Boolean);
    if (missing.length) redirect(`/app/profiles/${id}/edit?err=${encodeURIComponent(`Add ${missing.join(", ")} before publishing.`)}`);
  }
  await db.profile.update({ where: { id }, data: { status: publish ? "PUBLISHED" : "HIDDEN" } });
  if (publish) await track("profile_published", user.id, { type: p.type });
  redirect(editPath(id, publish ? "Published — your profile is live." : "Profile hidden."));
}

export async function addSocialAccount(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  const platform = str(fd, "platform");
  const handle = str(fd, "handle", 80).replace(/^@/, "");
  if (!(PLATFORMS as readonly string[]).includes(platform) || !handle) redirect(`/app/profiles/${id}/edit?err=Choose+a+platform+and+handle#audience`);
  const er = float(fd, "engagementRate");
  const data = { url: url(fd, "url"), followers: int(fd, "followers"), avgViews: int(fd, "avgViews"), avgReach: int(fd, "avgReach"), engagementRate: er !== null ? Math.max(0, Math.min(100, er)) : null };
  // Creator-entered numbers are always CREATOR_REPORTED. Only a verified API sync (or an admin review) can upgrade the source.
  await db.socialAccount.upsert({
    where: { profileId_platform_handle: { profileId: id, platform, handle } },
    create: { profileId: id, platform, handle, ...data, source: "CREATOR_REPORTED" },
    update: { ...data, source: "CREATOR_REPORTED", verifiedAt: null },
  });
  await recompute(id);
  redirect(editPath(id, "Channel saved", "#audience"));
}

export async function removeSocialAccount(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  await db.socialAccount.deleteMany({ where: { id: str(fd, "accountId"), profileId: id } });
  await recompute(id);
  redirect(editPath(id, "Removed", "#audience"));
}

export async function addMetric(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  const key = str(fd, "key", 60);
  const value = float(fd, "value");
  if (!key || value === null || value < 0) redirect(`/app/profiles/${id}/edit?err=Enter+a+metric+and+value#audience`);
  await db.metricRecord.create({ data: { profileId: id, key, value, source: "CREATOR_REPORTED" as MetricSource, periodLabel: optStr(fd, "periodLabel", 40) } });
  await recompute(id);
  redirect(editPath(id, "Metric added", "#audience"));
}

export async function removeMetric(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  await db.metricRecord.deleteMany({ where: { id: str(fd, "metricId"), profileId: id } });
  redirect(editPath(id, "Removed", "#audience"));
}

/** Parses lines like "Dubai: 45" into audience slices for one dimension. */
export async function setAudience(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  const dimension = str(fd, "dimension");
  if (!["GEO", "AGE", "INTEREST", "LANGUAGE", "GENDER"].includes(dimension)) redirect(editPath(id));
  const rows = str(fd, "rows", 2000)
    .split("\n")
    .map((l) => l.split(/[:=]/))
    .filter((x) => x.length === 2)
    .map(([b, v]) => ({ bucket: b.trim().slice(0, 60), share: Math.max(0, Math.min(100, Number(v.replace("%", "").trim()))) }))
    .filter((r) => r.bucket && Number.isFinite(r.share))
    .slice(0, 15);
  const total = rows.reduce((s, r) => s + r.share, 0);
  if (total > 100.5 && dimension !== "INTEREST") redirect(`/app/profiles/${id}/edit?err=${encodeURIComponent(`Shares add up to ${total}% — they should total 100% or less.`)}#audience`);
  await db.$transaction([
    db.audienceSlice.deleteMany({ where: { profileId: id, dimension } }),
    db.audienceSlice.createMany({ data: rows.map((r) => ({ profileId: id, dimension, ...r, source: "CREATOR_REPORTED" as MetricSource })) }),
  ]);
  await recompute(id);
  redirect(editPath(id, "Audience updated", "#audience"));
}

export async function addOffering(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  const kind = str(fd, "kind");
  const title = str(fd, "title", 120);
  if (!OFFERING_KINDS[kind] || !title) redirect(`/app/profiles/${id}/edit?err=Choose+a+format+and+title#offerings`);
  const priceType = (["FIXED", "FROM", "ON_REQUEST", "FREE"].includes(str(fd, "priceType")) ? str(fd, "priceType") : "FIXED") as PriceType;
  const priceFils = priceType === "FREE" || priceType === "ON_REQUEST" ? null : parseAedToFils(fd.get("price"));
  if ((priceType === "FIXED" || priceType === "FROM") && !priceFils) redirect(`/app/profiles/${id}/edit?err=Enter+a+price+in+AED#offerings`);
  await db.offering.create({
    data: {
      profileId: id, kind, title, description: optStr(fd, "description", 1000), priceType, priceFils,
      deliveryDays: int(fd, "deliveryDays"), inventoryTotal: int(fd, "inventoryTotal"), bookable: bool(fd, "bookable"), durationMin: int(fd, "durationMin"),
    },
  });
  await recompute(id);
  redirect(editPath(id, "Package added", "#offerings"));
}

export async function toggleOffering(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  const o = await db.offering.findFirst({ where: { id: str(fd, "offeringId"), profileId: id } });
  if (o) await db.offering.update({ where: { id: o.id }, data: { isActive: !o.isActive } });
  await recompute(id);
  redirect(editPath(id, "Updated", "#offerings"));
}

export async function addAvailability(fd: FormData) {
  const id = str(fd, "id");
  const user = await guard(id);
  const weekday = int(fd, "weekday");
  const start = hhmmToMinutes(str(fd, "start"));
  const end = hhmmToMinutes(str(fd, "end"));
  if (weekday === null || weekday < 0 || weekday > 6 || start === null || end === null || end <= start) redirect(`/app/profiles/${id}/edit?err=Check+the+day+and+times#availability`);
  await db.availabilityRule.create({ data: { profileId: id, weekday, startMinute: start, endMinute: end, timezone: user.timezone || "Asia/Dubai" } });
  await recompute(id);
  redirect(editPath(id, "Availability added", "#availability"));
}

export async function removeAvailability(fd: FormData) {
  const id = str(fd, "id");
  await guard(id);
  await db.availabilityRule.deleteMany({ where: { id: str(fd, "ruleId"), profileId: id } });
  redirect(editPath(id, "Removed", "#availability"));
}

export async function uploadDocument(fd: FormData) {
  const id = str(fd, "id");
  const user = await guard(id);
  const file = fd.get("file");
  const kind = str(fd, "kind");
  if (!(file instanceof File) || !kind) redirect(`/app/profiles/${id}/edit?err=Choose+a+file+and+document+type#verification`);
  try {
    const stored = await putFile(file, `docs-${id}`);
    await db.verificationDocument.create({
      data: { profileId: id, kind, reference: optStr(fd, "reference", 80), storageKey: stored.key, fileName: stored.name, mimeType: stored.mime, sizeBytes: stored.size, expiresAt: date(fd, "expiresAt") },
    });
    await audit(user.id, "document.upload", { type: "Profile", id }, { kind });
  } catch (e) {
    redirect(`/app/profiles/${id}/edit?err=${encodeURIComponent((e as Error).message)}#verification`);
  }
  redirect(editPath(id, "Document submitted for review", "#verification"));
}

export async function deleteProfile(fd: FormData) {
  const id = str(fd, "id");
  const user = await guard(id);
  const p = await db.profile.findUniqueOrThrow({ where: { id } });
  const active = await db.deal.count({ where: { OR: [{ initiatorProfileId: id }, { recipientProfileId: id }], status: { in: ["CONTRACTED", "FUNDED", "IN_PROGRESS", "DELIVERED", "DISPUTED"] } } });
  if (active) redirect(`/app/profiles/${id}/edit?err=This+profile+has+active+deals.+Complete+or+cancel+them+first.`);
  if (p.ownerUserId !== user.id) redirect(`/app/profiles/${id}/edit?err=Only+the+owner+can+delete+this+profile`);
  await db.profile.update({ where: { id }, data: { status: "HIDDEN", visibility: "PRIVATE", displayName: `${p.displayName} (deleted)`, bio: null, headline: null, avatarUrl: null, contactEmail: null } });
  await audit(user.id, "profile.delete", { type: "Profile", id });
  (await cookies()).delete("mj_profile");
  redirect("/app/profiles?ok=Profile+removed");
}
