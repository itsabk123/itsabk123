# 08 — Roadmap & post-launch optimisation

"All phases at once" was requested. This build delivers every phase to the extent it can be done
honestly **without licensed data, a payment provider, or production infrastructure**. Status below.

## 1. Phase status

| Phase | Delivered in v3 staging | Remaining (with blocker) |
|---|---|---|
| 1 Foundation & MVP | Brand & design system, homepage, auth (+MFA, reset), role onboarding, full property form (A–G, conditional, autosave), 16 calculators, valuation framework, reports, saved properties, admin, analytics, SEO foundation | Live audit of shelterandsense.com (network blocked) |
| 2 Investment intelligence | Monte Carlo, scenarios, sensitivity, Bayesian rent, comps + hedonic, Market Lab, portfolio, report versioning | Location intelligence from GIS data (needs OSM/GIS integration) |
| 3 Growth & marketplace | Agent/seller/creator accounts, public reports & gallery, embeds, referrals, marketplace, consented leads, matching, watch alerts | Payouts, lead billing (payments + legal) ; QR codes |
| 4 Global intelligence | Multi-currency with user FX, 30-country config & coverage matrix, enterprise API | Country integrations, tax rules, multilingual UI, live FX (data licences) |
| 5 Autonomous intelligence | Cron: purge, stale-report recalculation with notifications, data-quality & referral-fraud scans, kill switch, job log, overlap guard; rule-based analysis assistant | Source monitoring (no sources yet); LLM assistant over computed results (needs API key + spend limits); OCR document extraction |

## 2. Next 90 days (recommended order)
1. Deploy staging; verify `.htaccess`, email, cron, backups (QA §5).
2. Live audit of shelterandsense.com and decide domain/route strategy.
3. Integrate first licensed dataset in one launch market (e.g. HM Land Registry for UK or Dubai Pulse
   for UAE — **verify licences**), with `source_type` provenance; then un-gate that country's pages.
4. Payment provider + Pro/Professional checkout; price test.
5. Optional LLM "explain this report" over the stored result JSON only (no new numbers), with spend cap.
6. Port engine to a Python service when ML AVM work starts (Architecture option A), reusing the test fixtures.

## 3. Post-launch optimisation
- Weekly funnel review in admin: tool → evaluation → sign-up → share → enquiry; set baselines after 4 weeks.
- Monthly model review: once transactions are licensed, track valuation error vs later sales by
  market and price band; publish calibration; recalibrate comp weights.
- Monte Carlo defaults: compare user-set uncertainty with observed index volatility per market.
- Content: one sourced market analysis per launch market per month; refresh stale articles (timestamp shown).
- Growth: top 10 creators/agents by activated referrals → partner programme pilot.
- Performance: CrUX/Lighthouse monthly; keep JS < 10 KB on core pages.
