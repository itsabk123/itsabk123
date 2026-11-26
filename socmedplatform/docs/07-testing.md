# 07 · Testing

| Suite | Command | Covers |
|---|---|---|
| Unit (Vitest, 26 tests) | `npm test` | Matching (fit, budget, missing data, weights, outliers, no protected attributes, exclusion) · fees & VAT · state machine & payout guard · contract determinism & wording · payer defaults · timezone & slot generation · liquidity flags · fraud & spam heuristics · compliance & permit expiry · money parsing |
| End-to-end (Playwright, 21 steps) | `npm run build && npm start` then `node tests/e2e/flow.mjs` (with `npm run db:seed:demo`, `ALLOW_SANDBOX_PAYMENTS=1`) | Auth redirect · sign-up + email verify · onboarding/publish · discovery match scores · package request · counter & accept · dual signature · no payout before payment · forged webhook rejected · sandbox payment → FUNDED/HELD/invoice · start/submit · tracked-link dedupe · approve → COMPLETED/ELIGIBLE/CRM · double-blind reviews · cross-tenant deal access blocked · admin console blocked · admin payout · guest pitch · multi-role account · 375px no horizontal scroll |
| Types | `npm run typecheck` | |

Last run: all 26 unit tests and 21/21 e2e steps passed.

**Still to add:** load test (k6) on discovery and deal pages; dispute/refund e2e; booking reschedule e2e; accessibility audit (axe); Arabic RTL visual regression; slow-network Lighthouse run.
