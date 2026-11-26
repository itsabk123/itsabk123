# 02 · Business model

All numbers are **admin-configurable** (Admin → Pricing & config) and seeded as placeholders. Set real values after the pricing validation in `01-market-research.md`.

| Stream | Status in build | Mechanics |
|---|---|---|
| Marketplace commission | **Live** | % per deal kind (podcast sponsorship, influencer, guest, UGC, events, ambassador), deducted from payee payout; agency discount; minimum paid deal; VAT on platform fee. `src/lib/fees.ts` |
| Subscriptions | **Live (manual activation)** | Plans editable in admin; free-tier limits enforced (active campaigns, invites/applications per 30 days). Self-serve recurring billing off until a provider is confirmed — admins grant plans after invoicing. |
| Featured placement | **Live** | Admin sets `featuredUntil`; shown in a separate strip labelled "Featured · paid placement", never mixed into organic ranking. |
| Founding promotions | **Live (config)** | Promotion records (commission discount, free featured days, free verification, first campaign fee-free) with expiry and max redemptions. |
| Lead generation | Designed, not built | Requires explicit consent flows; phase 6. |
| Managed campaigns | Operational | "Request assisted matchmaking" / managed topics route to contact inbox. |
| Data & insights | Designed | Only aggregated, anonymised segment data (e.g. liquidity tables). Never identifiable data or deal terms. |

## Unit economics to measure (not assumed)
GMV, take rate, net revenue, contribution margin after payment fees, CAC per side, LTV, repeat collaboration rate. Admin overview computes GMV, commission, MRR, refunds and funnel live.

## Cold start / liquidity
- Supply-first in two niches; recruit hosts/creators where admin **Marketplace health** shows "undersupplied", brands where "oversupplied".
- Founding-member benefits as time-boxed promotions (not permanent price cuts).
- Concierge matchmaking from empty-state CTAs.
- Referral rewards qualify only when the referee **completes a collaboration** (not on sign-up).
