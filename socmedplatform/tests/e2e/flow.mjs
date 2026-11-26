// End-to-end business-flow test. Requires a running app (BASE_URL, default http://localhost:3000)
// seeded with `npm run db:seed:demo`. Run: node tests/e2e/flow.mjs
import { createRequire } from "node:module";
// Uses the project's playwright if installed, otherwise a global install (resolved via NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient();
const stamp = Date.now();
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push(["✓", name]); console.log("✓", name); }
  catch (e) { results.push(["✗", name]); console.error("✗", name, "\n ", e.message); throw e; }
};

const browser = await chromium.launch();
const ctxFor = async () => (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL(/\/app/), page.click("button:has-text('Log in')")]);
}
const ok = async (page) => {
  const err = await page.locator('[role=status].text-bad, [role=status]:has-text("err")').count();
  const text = await page.locator("[role=status]").allInnerTexts();
  return { err, text: text.join(" ") };
};

let brandPage, creatorPage, adminPage, dealUrl;
const brandEmail = `brand${stamp}@e2e.test`;

try {
  brandPage = await ctxFor();
  await step("unauthenticated /app redirects to login", async () => {
    const res = await brandPage.goto(`${BASE}/app`);
    assert.match(brandPage.url(), /\/login\?next=/);
    assert.ok(res);
  });

  await step("brand signs up and lands in onboarding", async () => {
    await brandPage.goto(`${BASE}/signup?role=BRAND`);
    await brandPage.fill("#name", "E2E Brand Owner");
    await brandPage.fill("#email", brandEmail);
    await brandPage.fill("#password", "Sup3rsecretpass");
    await brandPage.check("input[name=terms]");
    await Promise.all([brandPage.waitForURL(/onboarding/), brandPage.click("button:has-text('Create account')")]);
  });

  await step("email verification link (from outbox) verifies the account", async () => {
    const mail = await db.emailOutbox.findFirst({ where: { to: brandEmail, subject: "Confirm your email" }, orderBy: { createdAt: "desc" } });
    const link = mail.body.match(/verify-email\?token=[\w-]+/)[0];
    await brandPage.goto(`${BASE}/${link}`);
    await brandPage.getByText("Email confirmed").waitFor();
  });

  await step("brand creates and publishes a profile (progressive onboarding)", async () => {
    await brandPage.goto(`${BASE}/app/onboarding?role=BRAND`);
    await brandPage.fill("#displayName", `E2E Realty ${stamp}`);
    await brandPage.fill("#headline", "Homes in Dubai");
    await brandPage.selectOption("#emirate", "Dubai");
    await brandPage.selectOption("#industry", "Real estate");
    await Promise.all([brandPage.waitForURL(/\/edit/), brandPage.click("button:has-text('Create profile')")]);
    await Promise.all([brandPage.waitForURL(/ok=Published/), brandPage.click("button:has-text('Publish profile')")]);
  });

  await step("discovery shows match scores for signed-in brand", async () => {
    await brandPage.goto(`${BASE}/discover/influencers?emirate=Dubai`);
    await brandPage.getByText("Layla Creates (Demo)").first().waitFor();
    assert.ok((await brandPage.locator('[title="Match score"]').count()) > 0);
  });

  await step("brand requests a creator package → deal created", async () => {
    await brandPage.goto(`${BASE}/p/layla-creates-demo`);
    await Promise.all([brandPage.waitForURL(/deals\/new/), brandPage.locator("a:has-text('Request')").first().click()]);
    await brandPage.fill("#publishDate", "2026-12-20");
    await brandPage.fill("#message", "Hi Layla — keen to feature our new launch.");
    await Promise.all([brandPage.waitForURL(/\/app\/deals\/c/), brandPage.click("button:has-text('Send proposal')")]);
    dealUrl = brandPage.url().split("?")[0];
    await brandPage.getByText("Waiting for Layla Creates (Demo)").waitFor();
  });

  creatorPage = await ctxFor();
  await step("creator counter-offers; brand accepts", async () => {
    await login(creatorPage, "demo.inf1@demo.test", "demo-password-123");
    await creatorPage.goto(dealUrl);
    await creatorPage.click("summary:has-text('Propose different terms')");
    await creatorPage.fill("#price", "3800");
    await Promise.all([creatorPage.waitForURL(/ok=Counter/), creatorPage.click("button:has-text('Send counter-offer')")]);
    await brandPage.goto(dealUrl);
    await Promise.all([brandPage.waitForURL(/ok=Terms/), brandPage.click("button:has-text('Accept these terms')")]);
    const deal = await db.deal.findUnique({ where: { id: dealUrl.split("/").pop() }, include: { contract: true } });
    assert.equal(deal.status, "AGREED");
    assert.ok(deal.contract.body.includes("AED"));
  });

  await step("both parties sign the generated agreement", async () => {
    for (const p of [brandPage, creatorPage]) {
      await p.goto(dealUrl);
      await p.check("input[name=confirm]");
      await Promise.all([p.waitForURL(/ok=/), p.click("button:has-text('Sign agreement')")]);
    }
    const deal = await db.deal.findUnique({ where: { id: dealUrl.split("/").pop() } });
    assert.equal(deal.status, "CONTRACTED");
  });

  await step("creator cannot be paid before payment is confirmed (no payout exists)", async () => {
    assert.equal(await db.payout.count({ where: { dealId: dealUrl.split("/").pop() } }), 0);
  });

  await step("forged webhook is rejected", async () => {
    const res = await fetch(`${BASE}/api/webhooks/payments/sandbox`, { method: "POST", headers: { "x-sandbox-signature": "bogus" }, body: JSON.stringify({ id: "evt_x", type: "payment.succeeded", ref: "sbx_x" }) });
    assert.equal(res.status, 400);
  });

  await step("brand pays via sandbox checkout → deal FUNDED, payout HELD, invoice issued", async () => {
    await brandPage.goto(dealUrl);
    await Promise.all([brandPage.waitForURL(/pay\/sandbox/), brandPage.click("button:has-text('Pay securely')")]);
    await Promise.all([brandPage.waitForURL(/ok=Sandbox/), brandPage.click("button:has-text('Simulate successful payment')")]);
    const id = dealUrl.split("/").pop();
    const deal = await db.deal.findUnique({ where: { id }, include: { payouts: true, payments: { include: { invoice: true } } } });
    assert.equal(deal.status, "FUNDED");
    assert.equal(deal.payouts[0].status, "HELD");
    assert.equal(deal.payouts[0].amountFils, 380000 - 45600 - 2280);
    assert.ok(deal.payments[0].invoice);
  });

  await step("creator starts work and submits the deliverable", async () => {
    await creatorPage.goto(dealUrl);
    await Promise.all([creatorPage.waitForURL(/ok=Marked/), creatorPage.click("button:has-text('Start work')")]);
    await creatorPage.fill("input[name=submissionUrl]", "https://example.com/draft-reel");
    await Promise.all([creatorPage.waitForURL(/ok=Submitted/), creatorPage.click("button:has-text('Submit')")]);
  });

  await step("brand creates a tracked link; a click is counted once", async () => {
    await brandPage.goto(dealUrl);
    await brandPage.fill("input[name=destination]", "https://example.com/launch");
    await Promise.all([brandPage.waitForURL(/ok=Tracking/), brandPage.click("button:has-text('Create tracked link')")]);
    const link = await db.trackingLink.findFirst({ where: { dealId: dealUrl.split("/").pop() } });
    for (let i = 0; i < 2; i++) await fetch(`${BASE}/r/${link.slug}`, { redirect: "manual", headers: { "user-agent": "e2e-browser" } });
    assert.equal((await db.trackingLink.findUnique({ where: { id: link.id } })).clicks, 1);
    assert.ok(link.destinationUrl.includes("utm_source=majlis"));
  });

  await step("brand approves → deal COMPLETED, payout ELIGIBLE, CRM updated", async () => {
    await brandPage.goto(dealUrl);
    await Promise.all([brandPage.waitForURL(/ok=Approved/), brandPage.click("button[value=approve]")]);
    const id = dealUrl.split("/").pop();
    const deal = await db.deal.findUnique({ where: { id }, include: { payouts: true } });
    assert.equal(deal.status, "COMPLETED");
    assert.equal(deal.payouts[0].status, "ELIGIBLE");
    const crm = await db.crmContact.findFirst({ where: { ownerProfileId: deal.initiatorProfileId, contactProfileId: deal.recipientProfileId } });
    assert.equal(crm.stage, "COMPLETED");
  });

  await step("double-blind reviews publish only when both are in", async () => {
    const id = dealUrl.split("/").pop();
    await brandPage.goto(dealUrl);
    await brandPage.locator("label.check:has-text('5★')").click();
    await Promise.all([brandPage.waitForURL(/ok=Thanks/), brandPage.click("button:has-text('Submit review')")]);
    assert.equal((await db.review.findFirst({ where: { dealId: id } })).state, "PENDING_REVEAL");
    await creatorPage.goto(dealUrl);
    await creatorPage.locator("label.check:has-text('4★')").click();
    await Promise.all([creatorPage.waitForURL(/ok=Thanks/), creatorPage.click("button:has-text('Submit review')")]);
    assert.equal(await db.review.count({ where: { dealId: id, state: "PUBLISHED" } }), 2);
  });

  await step("creator cannot access another party's deal (tenant isolation)", async () => {
    const other = await db.deal.create({ data: { origin: "INVITATION", kind: "OTHER", title: "Private", initiatorProfileId: (await db.profile.findFirst({ where: { slug: "palm-homes-realty-demo" } })).id, recipientProfileId: (await db.profile.findFirst({ where: { slug: "omar-drives-demo" } })).id } });
    await creatorPage.goto(`${BASE}/app/deals/${other.id}`);
    assert.match(creatorPage.url(), /err=Not\+authorised/);
    await db.deal.delete({ where: { id: other.id } });
  });

  await step("non-admin cannot open the admin console", async () => {
    await creatorPage.goto(`${BASE}/admin`);
    assert.match(creatorPage.url(), /\/app\?err=Not\+authorised/);
  });

  adminPage = await ctxFor();
  await step("admin records the payout as paid", async () => {
    await login(adminPage, "admin@example.com", "change-me-admin-123");
    await adminPage.goto(`${BASE}/admin/finance`);
    const row = adminPage.locator("tr", { hasText: "Layla" }).first();
    await row.locator("input[name=reference]").fill(`TRX-${stamp}`);
    await Promise.all([adminPage.waitForURL(/ok=Payout/), row.locator("button:has-text('Mark paid')").click()]);
    const po = await db.payout.findFirst({ where: { dealId: dealUrl.split("/").pop() } });
    assert.equal(po.status, "PAID");
    assert.ok(await db.auditLog.findFirst({ where: { action: "payout.paid", targetId: po.id } }));
  });

  await step("guest pitches a podcast (multi-role: guest → host)", async () => {
    const g = await ctxFor();
    await login(g, "demo.guest2@demo.test", "demo-password-123");
    await g.goto(`${BASE}/p/the-gulf-money-show-demo`);
    await Promise.all([g.waitForURL(/deals\/new/), g.click("a:has-text('Pitch myself as a guest')")]);
    await g.fill("#price", "0");
    await Promise.all([g.waitForURL(/\/app\/deals\/c/), g.click("button:has-text('Send proposal')")]);
    const d = await db.deal.findUnique({ where: { id: g.url().split("?")[0].split("/").pop() } });
    assert.equal(d.origin, "PITCH");
    assert.equal(d.kind, "GUEST_APPEARANCE");
  });

  await step("one user can hold a second role and switch to it", async () => {
    await creatorPage.goto(`${BASE}/app/onboarding?role=GUEST`);
    await creatorPage.fill("#displayName", "Layla as a guest (E2E)");
    await Promise.all([creatorPage.waitForURL(/\/edit/), creatorPage.click("button:has-text('Create profile')")]);
    const user = await db.user.findUnique({ where: { email: "demo.inf1@demo.test" }, include: { profiles: true } });
    assert.ok(user.profiles.some((p) => p.type === "INFLUENCER") && user.profiles.some((p) => p.type === "GUEST"));
  });

  await step("mobile viewport renders home and discovery without horizontal scroll", async () => {
    const m = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage();
    for (const path of ["/", "/discover/podcasts", "/p/the-gulf-money-show-demo", "/pricing"]) {
      await m.goto(`${BASE}${path}`);
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${path} overflows by ${overflow}px`);
    }
  });
} finally {
  await browser.close();
  await db.$disconnect();
  const failed = results.filter((r) => r[0] === "✗").length;
  console.log(`\n${results.length - failed}/${results.length} steps passed`);
  if (failed) process.exitCode = 1;
}
