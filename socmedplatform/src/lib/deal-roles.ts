import type { Deal, Proposal, Profile } from "@prisma/client";

/** Who approves deliverables: the payer on paid deals; otherwise the brand, else the podcast, else the initiator. */
export function approverProfileId(deal: Deal & { initiator: Profile; recipient: Profile }, agreed: Proposal | null) {
  if (agreed?.payerProfileId && agreed.priceFils > 0) return agreed.payerProfileId;
  for (const t of ["BRAND", "AGENCY", "PODCAST"] as const) {
    if (deal.initiator.type === t) return deal.initiatorProfileId;
    if (deal.recipient.type === t) return deal.recipientProfileId;
  }
  return deal.initiatorProfileId;
}

export function otherParty(deal: Pick<Deal, "initiatorProfileId" | "recipientProfileId">, profileId: string) {
  return deal.initiatorProfileId === profileId ? deal.recipientProfileId : deal.initiatorProfileId;
}

export function payeeProfileId(deal: Pick<Deal, "initiatorProfileId" | "recipientProfileId">, agreed: Pick<Proposal, "payerProfileId"> | null) {
  if (!agreed?.payerProfileId) return null;
  return otherParty(deal, agreed.payerProfileId);
}

/** Default payer when a proposal is created: brands pay creators; guests pay for sponsored/promotional appearances; hosts pay for paid guests. */
export function defaultPayer(a: Profile, b: Profile, guestPaysHost = false): string {
  const brandSide = (p: Profile) => p.type === "BRAND" || p.type === "AGENCY";
  if (brandSide(a) && !brandSide(b)) return a.id;
  if (brandSide(b) && !brandSide(a)) return b.id;
  const guest = a.type === "GUEST" ? a : b.type === "GUEST" ? b : null;
  const host = a.type === "PODCAST" ? a : b.type === "PODCAST" ? b : null;
  if (guest && host) return guestPaysHost ? guest.id : host.id;
  return a.id;
}
