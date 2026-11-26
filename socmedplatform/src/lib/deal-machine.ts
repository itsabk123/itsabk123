import type { DealStatus } from "@prisma/client";

/** Allowed status transitions. Anything not listed is rejected server-side. */
export const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  PROPOSED: ["NEGOTIATING", "AGREED", "DECLINED", "CANCELLED"],
  NEGOTIATING: ["NEGOTIATING", "AGREED", "DECLINED", "CANCELLED"],
  AGREED: ["CONTRACTED", "CANCELLED", "NEGOTIATING"],
  CONTRACTED: ["FUNDED", "IN_PROGRESS", "CANCELLED"], // IN_PROGRESS directly when the deal is unpaid
  FUNDED: ["IN_PROGRESS", "DISPUTED", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "DISPUTED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "IN_PROGRESS", "DISPUTED"],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
  DISPUTED: ["IN_PROGRESS", "DELIVERED", "COMPLETED", "CANCELLED"],
};

export function canTransition(from: DealStatus, to: DealStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DealStatus, to: DealStatus) {
  if (!canTransition(from, to)) throw new Error(`Invalid deal transition ${from} → ${to}`);
}

export const STATUS_LABEL: Record<DealStatus, string> = {
  PROPOSED: "Proposed",
  NEGOTIATING: "Negotiating",
  AGREED: "Terms agreed",
  CONTRACTED: "Contract signed",
  FUNDED: "Payment received",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered — awaiting approval",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  DISPUTED: "In dispute",
};

export const ACTIVE_STATUSES: DealStatus[] = ["PROPOSED", "NEGOTIATING", "AGREED", "CONTRACTED", "FUNDED", "IN_PROGRESS", "DELIVERED", "DISPUTED"];

/** Payouts may only be released when the deal is completed and no dispute is open. */
export function payoutReleasable(deal: { status: DealStatus }, openDisputes: number) {
  return deal.status === "COMPLETED" && openDisputes === 0;
}
