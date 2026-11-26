# 01 — Audit, research and prioritisation

## 1. Audit of the existing assets

**shelterandsense.com** could not be fetched from the build environment (egress blocked by network
policy). A live audit of its branding, pages, SEO and conversion flow is therefore **still owed** —
see the roadmap gap list. Action: run Lighthouse + a crawl (e.g. Screaming Frog) against the live
domain and paste results into this section.

**Existing code in this repository (RealtyCompass, repo root, v1):**

| Area | Finding | Implication for v3 |
|---|---|---|
| Stack | PHP 8 + MySQL, no build step, shared hosting | Kept the stack so v3 deploys to the same host path. |
| Product | 3-step form → rules-based category match (residential/commercial/…) + lead email | Useful lead capture, but no property-level analysis. v3 replaces it with property evaluation. |
| Security | CSRF, honeypot, timing check, prepared statements | Patterns kept and extended (rate limits, MFA, audit log). |
| SEO | No meta descriptions, canonicals, structured data or sitemap | v3 adds all of these. |
| Conversion | Contact details required **before** any value is shown | v3 inverts this: value first, account optional. |
| Analytics | None | v3 adds first-party events and a funnel. |

## 2. User segments (ranked by value to the business)

1. **Individual / buy-to-let investors** — largest volume, drive organic usage of free tools; convert to Pro.
2. **Agents & brokers** — highest willingness to pay (branded reports, leads); bring listings (supply).
3. **International / cross-border investors** — most need for FX, risk and due-diligence structure.
4. **Content creators & educators** — distribution partners (embeds, referrals), low CAC.
5. **Sellers** — supply side of marketplace; seasonal, low frequency.
6. **Institutions / portals** — highest ACV via API & white-label; long sales cycle, needs licensed data first.

## 3. Competitor research (from general knowledge — **verify before external use**)

Live verification of current products, pricing and markets was not possible. Treat every cell as a
hypothesis to check.

| Competitor | Focus / audience | Coverage | Revenue model | Notable strength | Gap Shelter and Sense can target |
|---|---|---|---|---|---|
| Zillow | Consumer portal, Zestimate AVM | US | Agent advertising/leads | Traffic, AVM brand | No investor-grade probability or risk analysis |
| Redfin | Brokerage + portal | US/CA | Brokerage commissions | Transaction data | Not investor-focused |
| Realtor.com | Portal | US | Agent leads | Listing completeness | Same |
| Rightmove | Portal | UK | Agent subscriptions | Market share | Little investment analysis |
| Zoopla | Portal + valuations | UK | Agent subscriptions | Estimates | Same |
| Property Finder | Portal | UAE/GCC | Agent subscriptions | Regional leader | Investment analytics limited |
| Bayut | Portal | UAE/GCC | Agent subscriptions | Transaction data surfaced | Same |
| Idealista | Portal + data | ES/IT/PT | Agent subs, data | Price reports | Investor simulation absent |
| REA Group | Portal | AU (+Asia) | Agent depth products | Data assets | Same |
| LoopNet | Commercial listings | US | Broker listing fees | CRE inventory | Analysis thin |
| CoStar | CRE data & analytics | US/UK+ | Enterprise subscriptions | Deepest CRE data | Expensive, institutional only |
| Mashvisor | US rental/STR analytics | US | Subscriptions | Airbnb data | US-only; opaque estimates |
| DealCheck | Deal calculators | Global (user data) | Freemium | Simple underwriting UX | No simulation/probability, limited valuation evidence |
| BiggerPockets | Community + calculators | US-centric | Membership, ads | Audience/community | Calculators basic |
| HouseCanary | AVM & data API | US | Enterprise/API | Valuation accuracy | B2B only |
| ATTOM | Property data API | US | Data licensing | Breadth of records | Raw data, no decision layer |
| CoreLogic (Cotality) | Data & analytics | US/AU/NZ+ | Enterprise | Data depth | Enterprise only |
| PriceHubble | AVM & B2B2C tools | EU/JP | B2B SaaS | White-label valuation | B2B focus |
| PropStream | Investor lead data | US | Subscription | Off-market lists | US-only, list-centric |
| Realyse | UK resi data platform | UK | B2B subscriptions | Granular UK data | B2B only |

### Ten strongest opportunities
1. **Global, currency-agnostic underwriting** — most analysis tools are single-country.
2. **Probability, not a point estimate** — Monte Carlo + P(target) in a consumer UX.
3. **Radical transparency** — provenance labels on every input; published scoring curves.
4. **Honest valuation evidence** — "insufficient evidence" instead of a guessed AVM number.
5. **Cross-border investor needs** — FX-adjusted returns, foreign-buyer due diligence.
6. **Investor-ready seller/agent reports** that buyers can re-run with their own assumptions.
7. **Embeddable tools for creators/agents** with attribution → low-CAC distribution.
8. **Due-diligence workflow** inside the report (checklist, seller questions).
9. **MENA focus** (GCC portals are strong on listings, weaker on investment analytics) — verify.
10. **API for portals/fintechs** that want underwriting without building it.

## 4. Top-20 module assessment

Status legend: **Built** = backend, validation, permissions, tests in this build. **Partial** = works on user-supplied data or with stated limits. **Not built** = documented only.

| # | Module | Target user | Status in v3 | Main dependency to finish |
|---|---|---|---|---|
| 1 | Property evaluation engine | All | Built (`lib/Analysis.php`) | — |
| 2 | AI-powered valuation | Investors, sellers | Partial — comps + hedonic on user comps; no ML AVM | Licensed transaction data |
| 3 | Rental yield & cash flow | All | Built | — |
| 4 | ROI/IRR/NPV | All | Built (+MIRR, equity multiple, real IRR) | — |
| 5 | Bayesian probability engine | Investors | Partial — normal–normal rent update | More evidence types |
| 6 | Monte Carlo | Investors | Built (seeded, convergence, VaR/CVaR, FX) | — |
| 7 | Risk assessment | Investors | Built (rule-based register; "not assessed" where no data) | Climate/flood datasets |
| 8 | Location intelligence | Investors | Partial — user-reported only | OSM / GIS integration |
| 9 | Market intelligence dashboard | Investors, creators | Partial — Market Lab on pasted data; coverage matrix | Licensed indices |
| 10 | Property comparison | Investors | Built (calculator, 2 properties) | Multi-report comparison view |
| 11 | Buy/hold/sell/rent assistant | Investors | Partial — buy-vs-rent tool, objective fit | Hold/sell module |
| 12 | Financing & mortgage | All | Built (IO, fixed/variable, affordability) | Lender product data |
| 13 | Scenario & sensitivity | Investors | Built (4 scenarios, tornado, matrix, vacancy) | Custom user scenarios |
| 14 | Portfolio management | Investors | Built (basic, per-currency totals) | Performance history |
| 15 | Opportunity discovery | Investors | Partial — preference matching on listings | Data feeds |
| 16 | Seller & agent marketplace | Sellers, agents | Built (listings, moderation, watch, enquiries) | — |
| 17 | Lead generation & matching | Agents | Built (consented enquiries, lead statuses, matching) | Paid lead billing |
| 18 | Public reports & sharing | All | Built (private/unlisted/public, OG, embed, versions) | QR codes, server PDF |
| 19 | Embeddable widgets | Creators, agents | Built (16 tools, JS + iframe, themes, attribution) | — |
| 20 | Creator/affiliate/referral | Creators | Partial — attribution & dashboard; payouts off | Partner agreement, payments |

## 5. Feature prioritisation matrix

Score 1–5 (5 = best). Priority = (Demand + Revenue + Differentiation + Data readiness) − Cost.

| Module | Demand | Revenue | Cost (5=costly) | Data ready | Differentiation | Priority |
|---|---|---|---|---|---|---|
| Evaluation engine + report | 5 | 4 | 3 | 5 | 4 | **15** |
| Free calculators + embeds | 5 | 3 | 1 | 5 | 2 | **14** |
| Monte Carlo + scenarios | 4 | 4 | 2 | 5 | 5 | **16** |
| Sharing / public reports | 4 | 3 | 2 | 5 | 3 | **13** |
| Marketplace + leads | 3 | 5 | 3 | 4 | 3 | **12** |
| Referral program | 3 | 3 | 2 | 5 | 2 | **11** |
| Comps / hedonic valuation | 5 | 4 | 3 | 2 | 4 | **12** |
| Portfolio | 3 | 3 | 2 | 4 | 2 | **10** |
| ML AVM | 5 | 5 | 5 | 1 | 4 | **10** (blocked on data) |
| Location/geo intelligence | 4 | 3 | 4 | 1 | 3 | **7** |
| API / white-label | 2 | 5 | 3 | 4 | 3 | **11** |

Scores are judgement calls by the build team, to be replaced by measured demand (event data) after launch.
