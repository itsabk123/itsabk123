"use server";
import { redirect } from "next/navigation";
import type { CampaignStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canActFor, getActingContext } from "@/lib/access";
import { bool, date, int, list, optStr, str, url } from "@/lib/forms";
import { parseAedToFils } from "@/lib/money";
import { uniqueSlug } from "@/lib/slug";
import { campaignComplianceChecks } from "@/lib/compliance";
import { getConfig } from "@/lib/config";
import { audit, track } from "@/lib/audit";
import { createDeal } from "@/lib/deals";
import type { DealKind } from "@prisma/client";

export async function createCampaign(fd: FormData) {
  const user = await requireUser();
  const ctx = await getActingContext();
  const brand = ctx?.acting;
  if (!brand || (brand.type !== "BRAND" && brand.type !== "AGENCY")) redirect("/app?err=Switch+to+a+brand+profile+to+create+campaigns");
  const name = str(fd, "name", 160);
  const objective = str(fd, "objective", 80);
  if (!name || !objective) redirect("/app/campaigns/new?err=Name+and+objective+are+required");
  const creatorTypes = list(fd, "creatorTypes").filter((t) => ["PODCAST", "INFLUENCER", "GUEST"].includes(t));
  if (!creatorTypes.length) redirect("/app/campaigns/new?err=Choose+at+least+one+creator+type");
  const budgetMin = parseAedToFils(fd.get("budgetMin"));
  const budgetMax = parseAedToFils(fd.get("budgetMax"));
  if (budgetMin && budgetMax && budgetMin > budgetMax) redirect("/app/campaigns/new?err=Minimum+budget+is+above+maximum");
  const start = date(fd, "startDate"), end = date(fd, "endDate");
  if (start && end && end < start) redirect("/app/campaigns/new?err=End+date+is+before+start+date");

  const free = await getConfig("freeTier");
  const sub = await db.subscription.findFirst({ where: { userId: user.id, status: "ACTIVE", plan: { priceMonthlyFils: { gt: 0 } } } });
  const live = await db.campaign.count({ where: { brandProfileId: brand.id, status: { in: ["OPEN", "IN_PROGRESS", "PENDING_REVIEW"] } } });
  const publish = str(fd, "intent") === "publish";
  if (publish && !sub && live >= free.activeCampaigns) redirect(`/app/campaigns/new?err=${encodeURIComponent(`Free plan includes ${free.activeCampaigns} active campaign(s). Save as draft or upgrade.`)}`);

  const regulated = optStr(fd, "regulatedCategory", 40);
  const prohibited = await getConfig("prohibitedCategories");
  const compliance = campaignComplianceChecks({ regulatedCategory: regulated, prohibited, landingUrl: url(fd, "landingUrl"), brandVerified: !!brand.verifiedAt });
  if (compliance.status === "REJECTED") redirect("/app/campaigns/new?err=This+category+isn%27t+accepted+on+the+platform");

  let status: CampaignStatus = "DRAFT";
  if (publish) status = compliance.status === "PENDING" ? "PENDING_REVIEW" : "OPEN";

  const deliverableLines = str(fd, "deliverables", 3000).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
  const c = await db.campaign.create({
    data: {
      slug: uniqueSlug(name), brandProfileId: brand.id, createdByUserId: user.id, name, objective,
      product: optStr(fd, "product", 300), industry: optStr(fd, "industry", 80), targetCustomer: optStr(fd, "targetCustomer", 500),
      audienceType: optStr(fd, "audienceType", 10), targetEmirates: list(fd, "targetEmirates"), ageMin: int(fd, "ageMin"), ageMax: int(fd, "ageMax"),
      languages: list(fd, "languages"), budgetMinFils: budgetMin, budgetMaxFils: budgetMax, startDate: start, endDate: end,
      minAudience: int(fd, "minAudience"), creatorTypes, categories: list(fd, "categories"), contentFormats: list(fd, "contentFormats"),
      brandSafety: optStr(fd, "brandSafety", 1000), successMetrics: list(fd, "successMetrics"), callToAction: optStr(fd, "callToAction", 200),
      landingUrl: url(fd, "landingUrl"), instructions: optStr(fd, "instructions", 5000), recurring: bool(fd, "recurring"),
      visibility: str(fd, "visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC", status, regulatedCategory: regulated, complianceStatus: compliance.status,
      deliverables: {
        create: deliverableLines.map((l) => {
          const m = l.match(/^(\d+)\s*[x×]\s*(.+)$/i);
          return { kind: (m ? m[2] : l).slice(0, 120), quantity: m ? Math.min(50, Number(m[1])) : 1 };
        }),
      },
      compliance: { create: compliance.checks.map((ch) => ({ check: ch.label, status: ch.ok ? "APPROVED" : ch.required ? "PENDING" : "NOT_REQUIRED" })) },
    },
  });
  await audit(user.id, "campaign.create", { type: "Campaign", id: c.id }, { status });
  if (status !== "DRAFT") await track("campaign_published", user.id, { objective });
  redirect(`/app/campaigns/${c.id}?ok=${encodeURIComponent(status === "PENDING_REVIEW" ? "Submitted for compliance review — usually within 2 business days." : status === "OPEN" ? "Campaign is live." : "Draft saved.")}`);
}

export async function setCampaignStatus(fd: FormData) {
  const user = await requireUser();
  const c = await db.campaign.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  if (!(await canActFor(user.id, c.brandProfileId))) redirect("/app?err=Not+authorised");
  const to = str(fd, "status") as CampaignStatus;
  const allowed: Record<CampaignStatus, CampaignStatus[]> = {
    DRAFT: ["OPEN", "CANCELLED"], PENDING_REVIEW: ["DRAFT", "CANCELLED"], OPEN: ["IN_PROGRESS", "CANCELLED", "DRAFT"], IN_PROGRESS: ["COMPLETED", "OPEN"], COMPLETED: [], CANCELLED: [],
  };
  if (!allowed[c.status].includes(to)) redirect(`/app/campaigns/${c.id}?err=That+change+isn%27t+allowed`);
  let next = to;
  if (to === "OPEN" && c.complianceStatus === "PENDING") next = "PENDING_REVIEW";
  if (to === "OPEN" && c.complianceStatus === "REJECTED") redirect(`/app/campaigns/${c.id}?err=This+campaign+did+not+pass+compliance+review`);
  await db.campaign.update({ where: { id: c.id }, data: { status: next } });
  await audit(user.id, "campaign.status", { type: "Campaign", id: c.id }, { from: c.status, to: next });
  redirect(`/app/campaigns/${c.id}?ok=Updated`);
}

export async function inviteToCampaign(fd: FormData) {
  const user = await requireUser();
  if (!user.emailVerifiedAt) redirect(`/app/campaigns/${str(fd, "campaignId")}?err=Confirm+your+email+before+sending+invitations`);
  const c = await db.campaign.findUniqueOrThrow({ where: { id: str(fd, "campaignId") }, include: { deliverables: true } });
  if (!(await canActFor(user.id, c.brandProfileId))) redirect("/app?err=Not+authorised");
  if (!["OPEN", "IN_PROGRESS", "DRAFT"].includes(c.status)) redirect(`/app/campaigns/${c.id}?err=Campaign+is+not+active`);
  const ids = list(fd, "profileIds", 25);
  let sent = 0;
  for (const pid of ids) {
    const target = await db.profile.findUnique({ where: { id: pid } });
    if (!target || target.status !== "PUBLISHED") continue;
    const kind: DealKind = target.type === "PODCAST" ? "PODCAST_SPONSORSHIP" : target.type === "GUEST" ? "GUEST_APPEARANCE" : "INFLUENCER_CAMPAIGN";
    try {
      await createDeal({
        origin: "INVITATION", kind, title: c.name, initiatorProfileId: c.brandProfileId, recipientProfileId: pid, campaignId: c.id,
        matchScore: int(fd, `score_${pid}`),
        proposal: {
          priceFils: c.budgetMinFils ?? 0, payerProfileId: c.brandProfileId,
          deliverables: c.deliverables.length ? c.deliverables.map((d) => ({ title: `${d.quantity}× ${d.kind}` })) : [{ title: "Deliverables to be agreed" }],
          publishDate: c.startDate, message: optStr(fd, "message", 2000) ?? `We'd love to work with you on ${c.name}. Take a look at the brief and propose your terms.`,
        },
        actorUserId: user.id,
      });
      sent++;
    } catch { /* blocked or duplicate — skip */ }
  }
  redirect(`/app/campaigns/${c.id}?ok=${encodeURIComponent(`${sent} invitation(s) sent`)}`);
}
