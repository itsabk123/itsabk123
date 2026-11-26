import { describe, expect, it } from "vitest";
import { generateSlots, tzOffsetMinutes, zonedToUtc } from "@/lib/time";
import { liquidityTable } from "@/lib/liquidity";
import { engagementSignals, spamScore } from "@/lib/fraud";
import { campaignComplianceChecks, permitState } from "@/lib/compliance";
import { templateDraft } from "@/lib/ai";
import { parseAedToFils, formatAed } from "@/lib/money";

describe("time & booking slots", () => {
  it("Dubai is UTC+4", () => {
    expect(tzOffsetMinutes(new Date("2026-06-01T00:00:00Z"), "Asia/Dubai")).toBe(240);
    expect(zonedToUtc(2026, 12, 1, 10 * 60, "Asia/Dubai").toISOString()).toBe("2026-12-01T06:00:00.000Z");
  });
  it("generates slots from weekly rules and removes booked ones", () => {
    const from = new Date("2026-11-29T00:00:00Z"); // a Sunday
    const rules = [{ weekday: 1, startMinute: 600, endMinute: 780, timezone: "Asia/Dubai" }]; // Mon 10:00–13:00
    const all = generateSlots(rules, [], { from, days: 7, durationMin: 60, minLeadHours: 0 });
    expect(all.map((s) => s.startsAt.toISOString())).toEqual(["2026-11-30T06:00:00.000Z", "2026-11-30T07:00:00.000Z", "2026-11-30T08:00:00.000Z"]);
    const busy = [{ startsAt: new Date("2026-11-30T07:00:00Z"), endsAt: new Date("2026-11-30T08:00:00Z") }];
    expect(generateSlots(rules, busy, { from, days: 7, minLeadHours: 0 })).toHaveLength(2);
  });
});

describe("liquidity", () => {
  it("flags undersupplied and oversupplied segments", () => {
    const rows = liquidityTable({ "Real estate": 8, Gaming: 0 }, { "Real estate": 2, Gaming: 10 });
    expect(rows.find((r) => r.key === "Real estate")?.flag).toBe("undersupplied");
    expect(rows.find((r) => r.key === "Gaming")?.flag).toBe("oversupplied");
  });
});

describe("fraud signals", () => {
  it("only flags outliers, not normal accounts", () => {
    expect(engagementSignals([{ platform: "INSTAGRAM", followers: 50000, engagementRate: 3, avgViews: 9000 }])).toHaveLength(0);
    expect(engagementSignals([{ platform: "INSTAGRAM", followers: 50000, engagementRate: 45, avgViews: 9000 }])[0].kind).toBe("ENGAGEMENT_OUTLIER");
  });
  it("scores repeated link-heavy messages as spam", () => {
    expect(spamScore("Hi! Loved your last episode.", 0)).toBeLessThan(0.3);
    expect(spamScore("Guaranteed followers http://a http://b http://c", 4)).toBeGreaterThanOrEqual(0.7);
  });
});

describe("compliance", () => {
  it("routes regulated categories to human review and rejects prohibited ones", () => {
    expect(campaignComplianceChecks({ regulatedCategory: null, prohibited: [], landingUrl: null, brandVerified: false }).status).toBe("NOT_REQUIRED");
    expect(campaignComplianceChecks({ regulatedCategory: "HEALTHCARE", prohibited: [], landingUrl: null, brandVerified: true }).status).toBe("PENDING");
    expect(campaignComplianceChecks({ regulatedCategory: "GAMBLING", prohibited: ["GAMBLING"], landingUrl: null, brandVerified: true }).status).toBe("REJECTED");
  });
  it("tracks permit expiry", () => {
    const now = new Date("2026-11-01");
    expect(permitState(null, null, now).state).toBe("missing");
    expect(permitState("X", new Date("2026-10-01"), now).state).toBe("expired");
    expect(permitState("X", new Date("2026-11-20"), now).state).toBe("expiring");
    expect(permitState("X", new Date("2027-11-20"), now).state).toBe("ok");
  });
});

describe("drafts & money", () => {
  it("template drafts don't invent numbers", () => {
    const t = templateDraft("bio", { name: "Sara", location: "Dubai" });
    expect(t).not.toMatch(/\d{2,}/);
  });
  it("parses AED to integer fils", () => {
    expect(parseAedToFils("1,250.50")).toBe(125050);
    expect(parseAedToFils("-5")).toBeNull();
    expect(formatAed(125000)).toMatch(/1,250/);
  });
});
