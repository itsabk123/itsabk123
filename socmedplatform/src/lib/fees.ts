import type { DealKind } from "@prisma/client";
import type { PlatformConfigShape } from "./config";

export type FeeBreakdown = {
  dealFils: number;
  commissionPct: number;
  commissionFils: number;
  vatOnFeeFils: number;
  payerTotalFils: number;
  payeeNetFils: number;
};

/**
 * Commission is charged to the payee (deducted from payout). VAT applies to the platform's
 * fee (the service the platform supplies), not to the creator's fee — confirm treatment with a UAE tax adviser.
 * The payer pays the deal price; the payee receives price − commission − VAT on commission.
 */
export function calculateFees(
  dealFils: number,
  kind: DealKind,
  cfg: { commission: PlatformConfigShape["commission"]; vat: PlatformConfigShape["vat"] },
  opts: { agencyManaged?: boolean; commissionDiscountPct?: number } = {},
): FeeBreakdown {
  if (!Number.isInteger(dealFils) || dealFils < 0) throw new Error("dealFils must be a non-negative integer");
  let pct = Number(cfg.commission[kind] ?? cfg.commission.OTHER);
  if (opts.agencyManaged) pct -= cfg.commission.agencyDiscountPct;
  if (opts.commissionDiscountPct) pct -= opts.commissionDiscountPct;
  pct = Math.max(0, Math.min(50, pct));
  const commissionFils = Math.round((dealFils * pct) / 100);
  const vatOnFeeFils = cfg.vat.applyToPlatformFee ? Math.round((commissionFils * cfg.vat.ratePct) / 100) : 0;
  return {
    dealFils,
    commissionPct: pct,
    commissionFils,
    vatOnFeeFils,
    payerTotalFils: dealFils,
    payeeNetFils: Math.max(0, dealFils - commissionFils - vatOnFeeFils),
  };
}
