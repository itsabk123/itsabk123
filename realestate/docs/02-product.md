# 02 — Product requirements, journeys, permissions, monetisation

## 1. Product requirements (summary PRD)

**Vision.** The global real estate investment intelligence platform: turn fragmented property
information into transparent, probabilistic, explainable investment decisions.

**Positioning.** "Make smarter property investment decisions with data, probability, financial
intelligence, and market insights." Decision support — never a guarantee or regulated advice.

**Must-have requirements (all met in v3 staging)**

| ID | Requirement | Acceptance | Implemented in |
|---|---|---|---|
| R1 | Evaluate any property in any currency without an account | Guest POST → report in < 5 s at 2,000 sims | `evaluate.php`, `lib/Analysis.php` |
| R2 | Every number explainable | Formula, provenance badge and model version visible | `report.php`, `methodology.php` |
| R3 | No invented data | Missing evidence → "unavailable/not assessed" | Valuation, risk, markets |
| R4 | Probabilistic outcomes | P5–P95, P(loss), P(target), VaR/CVaR, reproducible seed | `MonteCarlo` |
| R5 | Fair-value evidence | Comps (≥3) + hedonic (≥8), reconciled, asking gap | `Valuation` |
| R6 | Objective-specific suitability, not "good/bad" | Weights per objective + hard caps, separate risk/market/data ratings | `Scoring` |
| R7 | Role-specific experiences | Investor/seller/agent/creator dashboards, admin | `dashboard.php`, `admin.php` |
| R8 | Private by default, opt-in sharing | private/unlisted/public; address hidden when shared | `report.php` |
| R9 | Organic growth built in | 16 indexable tools, embeds, referrals, public gallery, sitemap | tools, embeds, partners |
| R10 | Security & privacy by design | CSRF, rate limits, MFA, audit log, export/delete | see 03 §6 |

**Out of scope for staging (explicit):** payments, ML AVM, licensed data feeds, OCR, server-side PDF,
QR codes, multilingual UI, LLM assistant. See roadmap.

## 2. Non-goals
- Not a listing portal competing on inventory volume.
- Not a lender, broker or valuer.

## 3. User journeys

**Investor (activation = first completed evaluation)**
1. Lands on a calculator from search or a creator embed (no sign-up) → result shown immediately.
2. "Run a full evaluation with these numbers" → evaluate form pre-filled.
3. Report (private, stored to browser guest key) → sees missing inputs & checklist.
4. Signs up to save/share → guest reports auto-claimed.
5. Sets preferences → matching listings; watches a listing → price-drop alert.
6. Adds to portfolio; edits inputs → new report version.

**Seller**: register (seller) → evaluate own property → "Publish as listing" (report linked) →
moderation → enquiries with consent → lead statuses → price change notifies watchers.

**Agent**: as seller + branding (brand, agency, licence — "not verified" until admin verifies) on
Professional plan → branded shared reports → embeds on agency site with referral code.

**Creator**: register (creator) → referral link + embed codes → dashboard: clicks, embed views,
evaluations from links, sign-ups, activated, paid.

**Admin**: moderate listings (approve/reject/sponsored), unpublish reports, manage articles with
disclosure labels, view funnel; super admin: roles, plans, suspensions, verification, settings, kill switches.

## 4. Role & permission matrix (source of truth: `Auth::PERMS`)

| Permission | Guest | Investor | Seller | Agent | Creator | Admin | Super admin |
|---|---|---|---|---|---|---|---|
| Use tools, run evaluation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save/share reports | browser only | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Portfolio | | ✓ | | ✓ | | ✓ | ✓ |
| Create listings / see leads | | | ✓ | ✓ | | ✓ | ✓ |
| Branding (needs Professional+) | | | | ✓ | ✓ | ✓ | ✓ |
| Referrals | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Moderate listings/reports, content, analytics | | | | | | ✓ | ✓ |
| Users, roles, plans, settings | | | | | | | ✓ |

Staff never see private reports in admin listings. Investor preferences are never exposed to listers.

## 5. Information architecture

```
Home
├─ Evaluate Property ─ Report (versions, sharing, docs, portfolio, publish as listing)
├─ Explore Markets ─ Country coverage pages ─ Market Lab (forecast / regression)
├─ Investment Tools ─ 16 calculators (each embeddable)
├─ Marketplace ─ Listing ─ Enquiry / Watch
├─ Insights ─ Articles
├─ Pricing
├─ Account: Login · Sign up · Forgot/Reset · Dashboard (tabs) · Account & security
├─ Footer: Example report · Public reports · Partners · API & embeds · Methodology · Privacy · Terms
└─ Admin (role-gated)
```

## 6. Monetisation strategy & matrix

Principle: **monetisation never changes a calculation, score or ranking inside a report.**

| User type | Primary product | Secondary | Conversion trigger |
|---|---|---|---|
| Investor | Pro subscription | Pay-per-report (planned), affiliate services (mortgage, insurance) | Report limit, sim limit, document storage |
| Agent/broker | Professional subscription | Qualified-lead fees, sponsored listings | Branded reports, lead inbox, unbranded embeds |
| Seller | Listing fees / sponsored listing | Investor-ready report | Enquiries |
| Creator | Revenue share (referral) | Sponsored research | Referral dashboard |
| Portals / institutions | Enterprise API, white-label | Custom research | API key, bulk |
| Service providers | Lead/referral fees | Advertising | Marketplace demand |

Implemented: plan entitlements (`Auth::ENTITLEMENTS`), sponsored flag + label, referral attribution,
API keys. **Not implemented:** payment processing, invoices, payouts, lead billing — require a payment
provider and legal review of referral-fee rules per market (brokerage licensing).

## 7. Pricing architecture

| Plan | Limits (as coded) | Price |
|---|---|---|
| Free | 10 reports, 2,000 sims, 3 docs, attribution on embeds | Free |
| Pro | 250 reports, 10,000 sims, 50 docs | To be tested |
| Professional | 1,000 reports, branding, unbranded embeds, 200 docs | To be tested |
| Enterprise | API, 100k reports, 2,000 docs | Contact |

Price points are deliberately not invented. Method: van Westendorp survey with early users + A/B test
of two Pro price points once payments are live; anchor Professional to agent lead value.

## 8. Admin control centre (`admin.php`)
Overview KPIs · Analytics funnel · Users (search, role/plan/status/verification, access reset) ·
Listings moderation (duplicates detection, sponsored flag) · Shared reports (unpublish) · Content CMS
(disclosure labels) · Referrals (fraud spikes, void attribution) · Data & models (registry, sources,
quality checks) · Jobs log · Audit log · Settings/feature flags (super admin only).
