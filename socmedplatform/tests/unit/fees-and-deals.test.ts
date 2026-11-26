import { describe, expect, it } from "vitest";
import { calculateFees } from "@/lib/fees";
import { canTransition, payoutReleasable, TRANSITIONS } from "@/lib/deal-machine";
import { DEFAULT_CONFIG } from "@/lib/config";
import { renderContract } from "@/lib/contract";
import { defaultPayer } from "@/lib/deal-roles";
import type { Profile } from "@prisma/client";

const cfg = { commission: DEFAULT_CONFIG.commission, vat: DEFAULT_CONFIG.vat };

describe("fees", () => {
  it("deducts commission and VAT on the fee from the payee", () => {
    const f = calculateFees(100_000, "PODCAST_SPONSORSHIP", cfg); // AED 1,000
    expect(f.commissionFils).toBe(12_000);
    expect(f.vatOnFeeFils).toBe(600);
    expect(f.payerTotalFils).toBe(100_000);
    expect(f.payeeNetFils).toBe(87_400);
  });
  it("applies agency discount and never goes negative", () => {
    expect(calculateFees(100_000, "INFLUENCER_CAMPAIGN", cfg, { agencyManaged: true }).commissionPct).toBe(10);
    expect(calculateFees(100_000, "OTHER", cfg, { commissionDiscountPct: 99 }).commissionPct).toBe(0);
  });
  it("rejects non-integer money", () => {
    expect(() => calculateFees(10.5, "OTHER", cfg)).toThrow();
  });
});

describe("deal state machine", () => {
  it("cannot jump from proposed to completed or funded", () => {
    expect(canTransition("PROPOSED", "COMPLETED")).toBe(false);
    expect(canTransition("PROPOSED", "FUNDED")).toBe(false);
  });
  it("terminal states have no exits", () => {
    for (const s of ["COMPLETED", "DECLINED", "CANCELLED"] as const) expect(TRANSITIONS[s]).toHaveLength(0);
  });
  it("only releases payouts on completed deals without open disputes", () => {
    expect(payoutReleasable({ status: "DELIVERED" }, 0)).toBe(false);
    expect(payoutReleasable({ status: "COMPLETED" }, 1)).toBe(false);
    expect(payoutReleasable({ status: "COMPLETED" }, 0)).toBe(true);
  });
  it("a dispute can be opened from funded/in-progress/delivered but not before payment", () => {
    expect(canTransition("FUNDED", "DISPUTED")).toBe(true);
    expect(canTransition("DELIVERED", "DISPUTED")).toBe(true);
    expect(canTransition("CONTRACTED", "DISPUTED")).toBe(false);
  });
});

describe("contract", () => {
  const input = { dealId: "d1", title: "Test", initiator: { name: "Brand", slug: "b" }, recipient: { name: "Creator", slug: "c" }, payer: { name: "Brand", slug: "b" }, priceFils: 500_000, deliverables: [{ title: "1 reel" }], publishDate: null, usageRights: null, exclusivity: null, revisions: 2, commissionPct: 12 };
  it("is deterministic and hash-stable", () => {
    expect(renderContract(input).hash).toBe(renderContract(input).hash);
    expect(renderContract({ ...input, priceFils: 1 }).hash).not.toBe(renderContract(input).hash);
  });
  it("never claims escrow and states it is not legal advice", () => {
    const { body } = renderContract(input);
    expect(body).toMatch(/not held in a regulated escrow/);
    expect(body).toMatch(/not legal advice/);
    expect(body).toMatch(/Use of the Platform does not grant any licence or permit/);
  });
});

describe("payer defaults", () => {
  const p = (id: string, type: Profile["type"]) => ({ id, type }) as Profile;
  it("brands pay creators; hosts pay paid guests unless the guest is buying a sponsored slot", () => {
    expect(defaultPayer(p("b", "BRAND"), p("i", "INFLUENCER"))).toBe("b");
    expect(defaultPayer(p("i", "INFLUENCER"), p("b", "BRAND"))).toBe("b");
    expect(defaultPayer(p("g", "GUEST"), p("h", "PODCAST"))).toBe("h");
    expect(defaultPayer(p("g", "GUEST"), p("h", "PODCAST"), true)).toBe("g");
  });
});
