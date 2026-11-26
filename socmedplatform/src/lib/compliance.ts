import { REGULATED_CATEGORIES } from "./taxonomy";

export type ComplianceCheck = { key: string; label: string; required: boolean; ok: boolean; note?: string };

/**
 * Configurable compliance checklist. These checks support — they do not replace — legal review.
 * UAE rules (e.g. UAE Media Council advertiser permit requirements, sector regulators for health, finance
 * and real estate) change; administrators must keep these rules current with counsel.
 */
export function campaignComplianceChecks(input: {
  regulatedCategory: string | null;
  prohibited: string[];
  landingUrl: string | null;
  brandVerified: boolean;
}): { status: "NOT_REQUIRED" | "PENDING" | "REJECTED"; checks: ComplianceCheck[] } {
  const checks: ComplianceCheck[] = [
    { key: "disclosure", label: "Creators must clearly disclose paid content (e.g. #ad / إعلان)", required: true, ok: true },
    { key: "landing", label: "Landing page provided for claims review", required: false, ok: !!input.landingUrl },
    { key: "brand_verified", label: "Advertiser business verification", required: !!input.regulatedCategory, ok: input.brandVerified },
  ];
  if (input.regulatedCategory) {
    if (input.prohibited.includes(input.regulatedCategory)) {
      checks.push({ key: "prohibited", label: `${REGULATED_CATEGORIES[input.regulatedCategory] ?? input.regulatedCategory} is not accepted on this platform`, required: true, ok: false });
      return { status: "REJECTED", checks };
    }
    checks.push({
      key: "sector_approval",
      label: `Sector approval evidence for ${REGULATED_CATEGORIES[input.regulatedCategory] ?? input.regulatedCategory}`,
      required: true,
      ok: false,
      note: "A moderator will review before the campaign is published.",
    });
    return { status: "PENDING", checks };
  }
  return { status: "NOT_REQUIRED", checks };
}

/**
 * Creator-side check: is the permit on file and in date? Membership of the platform is not a permit.
 * Context (verify against uaemc.gov.ae before launch): since 2026 the UAE Media Council requires an Advertiser Permit
 * for promotional social-media content (paid or unpaid); residents also need an electronic media trade licence, visitors
 * use a short-term visitor permit applied for via a licensed agency, and holders must display the permit number.
 */
export function permitState(permitNo: string | null | undefined, expiresAt: Date | null | undefined, now = new Date()) {
  if (!permitNo) return { state: "missing" as const, label: "No advertiser permit on file" };
  if (expiresAt && expiresAt < now) return { state: "expired" as const, label: "Advertiser permit expired" };
  if (expiresAt && expiresAt.getTime() - now.getTime() < 30 * 86400_000) return { state: "expiring" as const, label: "Advertiser permit expires within 30 days" };
  return { state: "ok" as const, label: "Advertiser permit on file (self-declared until verified)" };
}
